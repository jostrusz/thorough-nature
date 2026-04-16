// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const [ai_job] = await service.listMarketingAiJobs({ id })
    if (!ai_job) {
      res.status(404).json({ error: "not_found" })
      return
    }
    res.json({ ai_job })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
