// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { isNonTrivialQuery } from "../../../../modules/marketing/utils/segment-evaluator"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const q = (req.query as any) || {}
    const filters: any = {}
    if (q.brand_id) filters.brand_id = q.brand_id
    const segments = await service.listMarketingSegments(filters)
    res.json({ segments })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    const required = ["brand_id", "name", "query"]
    for (const key of required) {
      if (!(key in body) || body[key] == null) {
        res.status(400).json({ error: `${key} is required` })
        return
      }
    }

    // Reject trivial queries: a query with no leaf conditions would either
    // match everyone (AND/empty) or no one (OR/empty). In the suppression
    // context NOT(FALSE) = TRUE also suppresses everyone. Always require
    // at least one real condition.
    if (!isNonTrivialQuery(body.query)) {
      res.status(400).json({ error: "Segment query must contain at least one condition" })
      return
    }

    const data: any = {
      brand_id: body.brand_id,
      name: body.name,
      description: body.description ?? null,
      query: body.query,
      is_suppression: body.is_suppression ?? false,
      metadata: body.metadata ?? null,
    }

    const segment = await service.createMarketingSegments(data)
    res.status(201).json({ segment })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
