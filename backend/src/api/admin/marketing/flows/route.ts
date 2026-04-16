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

    const flows = await service.listMarketingFlows(filters)
    res.json({ flows })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    const required = ["brand_id", "name", "trigger", "definition"]
    for (const key of required) {
      if (!(key in body) || body[key] == null) {
        res.status(400).json({ error: `${key} is required` })
        return
      }
    }

    const data: any = {
      brand_id: body.brand_id,
      name: body.name,
      description: body.description ?? null,
      trigger: body.trigger,
      definition: body.definition,
      status: body.status ?? "draft",
      version: 1,
      stats: body.stats ?? null,
      metadata: body.metadata ?? null,
    }

    const flow = await service.createMarketingFlows(data)
    res.status(201).json({ flow })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
