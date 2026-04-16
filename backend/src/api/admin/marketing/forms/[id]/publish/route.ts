// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id

    const [form] = await service.listMarketingForms({ id })
    if (!form) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const updated = await service.updateMarketingForms({ id, status: "live" })
    res.json({ form: updated })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
