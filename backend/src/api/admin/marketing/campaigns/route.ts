// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const q = (req.query as any) || {}
    const brand_id = q.brand_id
    if (!brand_id) {
      res.status(400).json({ error: "brand_id is required" })
      return
    }
    const filters: any = { brand_id }
    if (q.status) filters.status = q.status

    const campaigns = await service.listMarketingCampaigns(filters)
    res.json({ campaigns })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    const required = ["brand_id", "name"]
    for (const key of required) {
      if (!body[key]) {
        res.status(400).json({ error: `${key} is required` })
        return
      }
    }

    const data: any = {
      brand_id: body.brand_id,
      name: body.name,
      subject: body.subject ?? null,
      preheader: body.preheader ?? null,
      from_name: body.from_name ?? null,
      from_email: body.from_email ?? null,
      reply_to: body.reply_to ?? null,
      custom_html: body.custom_html ?? null,
      template_id: body.template_id ?? null,
      list_id: body.list_id ?? null,
      segment_id: body.segment_id ?? null,
      suppression_segment_ids: body.suppression_segment_ids ?? null,
      send_at: body.send_at ? new Date(body.send_at) : null,
      status: "draft",
      ab_test: body.ab_test ?? null,
      metadata: body.metadata ?? null,
    }

    const campaign = await service.createMarketingCampaigns(data)
    res.status(201).json({ campaign })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
