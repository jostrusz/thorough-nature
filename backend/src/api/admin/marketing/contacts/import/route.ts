// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

/**
 * Bulk import contacts.
 *
 * Body:
 *   {
 *     brand_ids: string[]              // required — one or more brands
 *     contacts: Row[]                  // required
 *     default_status?: string           // fallback status if row doesn't set one
 *   }
 *
 *   Row: {
 *     email: string (required)
 *     first_name?, last_name?, phone?, address_line1?, city?,
 *     postal_code?, company?, country_code?, locale?,
 *     external_id?, status?, source?,
 *     tags?: string[] | string,        // array or comma-separated
 *     properties?: Record<string, any> // any leftover CSV columns
 *   }
 *
 * Same email is imported once per selected brand (1 contact row per brand).
 * Per-brand scoping preserves GDPR consent isolation — unsubscribing from
 * Brand A doesn't affect Brand B.
 */

const IMPORTABLE_FIELDS = [
  "phone",
  "first_name",
  "last_name",
  "address_line1",
  "city",
  "postal_code",
  "company",
  "country_code",
  "locale",
  "external_id",
  "source",
]

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    // Accept brand_ids (new) or brand_id (back-compat).
    let brandIds: string[] = []
    if (Array.isArray(body.brand_ids)) {
      brandIds = body.brand_ids.filter((id: any) => typeof id === "string" && id.length > 0)
    } else if (typeof body.brand_id === "string" && body.brand_id.length > 0) {
      brandIds = [body.brand_id]
    }
    if (!brandIds.length) {
      res.status(400).json({ error: "brand_ids (array) or brand_id is required" })
      return
    }
    if (!Array.isArray(body.contacts) || body.contacts.length === 0) {
      res.status(400).json({ error: "contacts array is required" })
      return
    }

    const defaultStatus = body.default_status || body.status || "unconfirmed"

    // pg.Pool for the suppression check. The marketing module service has no
    // direct "is this email suppressed?" helper, and we want to avoid an N+1
    // query per row, so we preload the suppression set per brand below.
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 })

    let created = 0
    let updated = 0
    let suppressed = 0
    const errors: any[] = []

    try {
      // Preload all suppressed (lowercased) emails per brand into a Set so the
      // per-row check is O(1) instead of a DB round-trip per contact per brand.
      const suppressedByBrand: Record<string, Set<string>> = {}
      for (const brand_id of brandIds) {
        const set = new Set<string>()
        try {
          const { rows } = await pool.query(
            `SELECT lower(email) AS email
             FROM marketing_suppression
             WHERE brand_id = $1 AND deleted_at IS NULL`,
            [brand_id]
          )
          for (const r of rows) {
            if (r.email) set.add(String(r.email))
          }
        } catch (e: any) {
          // If the suppression preload fails for a brand, fail safe: treat the
          // brand's suppression set as unknown but DON'T silently resurrect
          // people. Re-throw so the whole import surfaces a clear error rather
          // than importing into a brand whose suppressions we couldn't read.
          throw new Error(
            `suppression_preload_failed for brand ${brand_id}: ${e?.message || String(e)}`
          )
        }
        suppressedByBrand[brand_id] = set
      }

      for (const row of body.contacts) {
        try {
          if (!row.email) {
            errors.push({ row, error: "email_missing" })
            continue
          }
          const email = String(row.email).toLowerCase().trim()

          // Normalize tags: accept array or comma-separated string.
          let tags: string[] | null = null
          if (Array.isArray(row.tags)) {
            tags = row.tags.map((t: any) => String(t).trim()).filter(Boolean)
          } else if (typeof row.tags === "string" && row.tags.length) {
            tags = row.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
          }

          // Process per brand — each brand gets its own contact row.
          for (const brand_id of brandIds) {
            // GDPR / deliverability guard: never (re)subscribe an email that
            // previously unsubscribed / hard-bounced / complained. Suppression
            // is per-brand, so check this brand's set only.
            if (suppressedByBrand[brand_id]?.has(email)) {
              suppressed++
              continue
            }

            const targetStatus = row.status ?? defaultStatus
            const settingSubscribed = targetStatus === "subscribed"

            const existing = await service.listMarketingContacts({ brand_id, email })

            if (existing && existing.length > 0) {
              const current = existing[0] as any
              const update: any = { id: current.id }
              for (const f of IMPORTABLE_FIELDS) {
                if (row[f] != null) update[f] = row[f]
              }
              if (row.status != null) update.status = row.status
              if (tags != null) update.tags = tags
              if (row.properties != null) update.properties = row.properties

              // Consent trace: if this update moves the contact to subscribed
              // and no consent timestamp exists yet, stamp a minimal one. Never
              // overwrite an existing consent_at.
              if (settingSubscribed && !current.consent_at) {
                update.consent_at = new Date()
                if (current.consent_version == null && row.consent_version == null) {
                  update.consent_version = "import"
                }
              }

              await service.updateMarketingContacts(update)
              updated++
            } else {
              const data: any = {
                brand_id,
                email,
                status: targetStatus,
                source: row.source ?? "import",
                tags,
                properties: row.properties ?? null,
              }
              for (const f of IMPORTABLE_FIELDS) {
                if (row[f] != null) data[f] = row[f]
              }

              // Consent trace for newly-subscribed imports (unless caller
              // already supplied a consent_at in the row).
              if (settingSubscribed && row.consent_at == null) {
                data.consent_at = new Date()
                if (row.consent_version == null) data.consent_version = "import"
              }

              await service.createMarketingContacts(data)
              created++
            }
          }
        } catch (e: any) {
          errors.push({ row, error: e?.message || String(e) })
        }
      }
    } finally {
      await pool.end().catch(() => {})
    }

    res.json({ created, updated, suppressed, errors, brands_count: brandIds.length })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
