// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const q = (req.query as any) || {}
    const filters: any = {}
    if (q.brand_id) filters.brand_id = q.brand_id
    if (q.status) filters.status = q.status
    if (q.type) filters.type = q.type

    const forms = await service.listMarketingForms(filters)
    res.json({ forms })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    const required = ["brand_id", "slug", "name"]
    for (const key of required) {
      if (!body[key]) {
        res.status(400).json({ error: `${key} is required` })
        return
      }
    }

    const data: any = {
      brand_id: body.brand_id,
      slug: String(body.slug).toLowerCase().trim(),
      name: body.name,
      type: body.type ?? "popup",
      config: body.config ?? null,
      styling: body.styling ?? null,
      custom_html: body.custom_html ?? null,
      custom_css: body.custom_css ?? null,
      fields: body.fields ?? null,
      preheader: body.preheader ?? null,
      success_action: body.success_action ?? null,
      target_list_ids: body.target_list_ids ?? null,
      target_segment_id: body.target_segment_id ?? null,
      double_opt_in: body.double_opt_in ?? null,
      consent_text: body.consent_text ?? null,
      status: body.status ?? "draft",
    }

    const form = await service.createMarketingForms(data)
    res.status(201).json({ form })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
