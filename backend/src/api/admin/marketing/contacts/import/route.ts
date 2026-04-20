// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
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

    let created = 0
    let updated = 0
    const errors: any[] = []

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
          const existing = await service.listMarketingContacts({ brand_id, email })

          if (existing && existing.length > 0) {
            const update: any = { id: (existing[0] as any).id }
            for (const f of IMPORTABLE_FIELDS) {
              if (row[f] != null) update[f] = row[f]
            }
            if (row.status != null) update.status = row.status
            if (tags != null) update.tags = tags
            if (row.properties != null) update.properties = row.properties
            await service.updateMarketingContacts(update)
            updated++
          } else {
            const data: any = {
              brand_id,
              email,
              status: row.status ?? defaultStatus,
              source: row.source ?? "import",
              tags,
              properties: row.properties ?? null,
            }
            for (const f of IMPORTABLE_FIELDS) {
              if (row[f] != null) data[f] = row[f]
            }
            await service.createMarketingContacts(data)
            created++
          }
        }
      } catch (e: any) {
        errors.push({ row, error: e?.message || String(e) })
      }
    }

    res.json({ created, updated, errors, brands_count: brandIds.length })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
