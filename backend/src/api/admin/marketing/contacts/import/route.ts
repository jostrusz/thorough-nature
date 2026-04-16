// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    if (!body.brand_id) {
      res.status(400).json({ error: "brand_id is required" })
      return
    }
    if (!Array.isArray(body.contacts)) {
      res.status(400).json({ error: "contacts array is required" })
      return
    }

    const brand_id = body.brand_id
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

        const existing = await service.listMarketingContacts({ brand_id, email })

        if (existing && existing.length > 0) {
          const update: any = { id: (existing[0] as any).id }
          if (row.first_name != null) update.first_name = row.first_name
          if (row.last_name != null) update.last_name = row.last_name
          if (row.phone != null) update.phone = row.phone
          if (row.locale != null) update.locale = row.locale
          if (row.country_code != null) update.country_code = row.country_code
          if (row.status != null) update.status = row.status
          if (row.tags != null) update.tags = row.tags
          if (row.properties != null) update.properties = row.properties
          if (row.source != null) update.source = row.source
          if (row.external_id != null) update.external_id = row.external_id
          await service.updateMarketingContacts(update)
          updated++
        } else {
          await service.createMarketingContacts({
            brand_id,
            email,
            phone: row.phone ?? null,
            first_name: row.first_name ?? null,
            last_name: row.last_name ?? null,
            locale: row.locale ?? null,
            country_code: row.country_code ?? null,
            status: row.status ?? "unconfirmed",
            source: row.source ?? "import",
            tags: row.tags ?? null,
            properties: row.properties ?? null,
            external_id: row.external_id ?? null,
          })
          created++
        }
      } catch (e: any) {
        errors.push({ row, error: e?.message || String(e) })
      }
    }

    res.json({ created, updated, errors })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
