// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

const UPDATABLE_FIELDS = [
  "slug",
  "name",
  "type",
  "config",
  "styling",
  "custom_html",
  "custom_css",
  "fields",
  "preheader",
  "success_action",
  "target_list_ids",
  "target_segment_id",
  "double_opt_in",
  "consent_text",
  "status",
  "metrics",
]

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const [form] = await service.listMarketingForms({ id })
    if (!form) {
      res.status(404).json({ error: "not_found" })
      return
    }
    res.json({ form })
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
        update[key] = key === "slug" && body.slug ? String(body.slug).toLowerCase().trim() : body[key]
      }
    }

    const form = await service.updateMarketingForms(update)
    res.json({ form })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    await service.deleteMarketingForms(id)
    res.status(200).json({ id, deleted: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
