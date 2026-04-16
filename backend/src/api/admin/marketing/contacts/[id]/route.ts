// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

const UPDATABLE_FIELDS = [
  "email",
  "phone",
  "first_name",
  "last_name",
  "locale",
  "country_code",
  "timezone",
  "status",
  "source",
  "consent_version",
  "consent_ip",
  "consent_user_agent",
  "consent_at",
  "unsubscribed_at",
  "external_id",
  "properties",
  "computed",
  "tags",
  "metadata",
]

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const [contact] = await service.listMarketingContacts({ id })
    if (!contact) {
      res.status(404).json({ error: "not_found" })
      return
    }
    res.json({ contact })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}

    const update: any = { id }
    for (const key of UPDATABLE_FIELDS) {
      if (key in body) {
        if ((key === "consent_at" || key === "unsubscribed_at") && body[key]) {
          update[key] = new Date(body[key])
        } else if (key === "email" && body.email) {
          update.email = String(body.email).toLowerCase().trim()
        } else {
          update[key] = body[key]
        }
      }
    }

    const contact = await service.updateMarketingContacts(update)
    res.json({ contact })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    await service.deleteMarketingContacts(id)
    res.status(200).json({ id, deleted: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
