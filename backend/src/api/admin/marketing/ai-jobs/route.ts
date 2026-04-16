// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"

const ALLOWED_TYPES = [
  "subject_generation",
  "body_generation",
  "segment_from_prompt",
  "brand_voice_training",
]

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const q = (req.query as any) || {}
    const brand_id = q.brand_id
    if (!brand_id) {
      res.status(400).json({ error: "brand_id is required" })
      return
    }

    const limit = Math.min(200, Math.max(1, Number(q.limit ?? 50)))

    const filters: any = { brand_id }
    if (q.status) filters.status = q.status
    if (q.type) filters.type = q.type

    const ai_jobs = await service.listMarketingAiJobs(filters, {
      take: limit,
      order: { created_at: "DESC" },
    })

    res.json({ ai_jobs })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const body = (req.body as any) || {}

    if (!body.brand_id) {
      res.status(400).json({ error: "brand_id is required" })
      return
    }
    if (!body.type) {
      res.status(400).json({ error: "type is required" })
      return
    }
    if (!ALLOWED_TYPES.includes(body.type)) {
      res.status(400).json({ error: `type must be one of: ${ALLOWED_TYPES.join(", ")}` })
      return
    }

    const data: any = {
      brand_id: body.brand_id,
      type: body.type,
      input: body.input ?? null,
      status: "queued",
    }

    const ai_job = await service.createMarketingAiJobs(data)
    res.status(201).json({ ai_job })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
