// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const q = (req.query as any) || {}
    const limit = Math.min(500, Math.max(1, Number(q.limit ?? 50)))
    const offset = Math.max(0, Number(q.offset ?? 0))

    const filters: any = {}
    if (q.brand_id) filters.brand_id = q.brand_id
    if (q.campaign_id) filters.campaign_id = q.campaign_id
    if (q.flow_id) filters.flow_id = q.flow_id
    if (q.contact_id) filters.contact_id = q.contact_id
    if (q.status) filters.status = q.status

    const messages = await service.listMarketingMessages(filters, {
      take: limit,
      skip: offset,
      order: { created_at: "DESC" },
    })

    res.json({ messages, limit, offset })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
