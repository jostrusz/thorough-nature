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

    const templates = await service.listMarketingTemplates(filters)
    res.json({ templates })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    const required = ["brand_id", "name", "subject"]
    for (const key of required) {
      if (!body[key]) {
        res.status(400).json({ error: `${key} is required` })
        return
      }
    }

    const data: any = {
      brand_id: body.brand_id,
      name: body.name,
      subject: body.subject,
      preheader: body.preheader ?? "",
      from_name: body.from_name ?? null,
      from_email: body.from_email ?? null,
      reply_to: body.reply_to ?? null,
      block_json: body.block_json ?? null,
      custom_html: body.custom_html ?? null,
      editor_type: body.editor_type ?? "blocks",
      version: 1,
      status: body.status ?? "draft",
      metadata: body.metadata ?? null,
    }

    const template = await service.createMarketingTemplates(data)
    res.status(201).json({ template })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
