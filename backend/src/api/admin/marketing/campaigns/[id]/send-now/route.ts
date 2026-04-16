// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id

    const [campaign] = await service.listMarketingCampaigns({ id })
    if (!campaign) {
      res.status(404).json({ error: "not_found" })
      return
    }

    if (!(campaign as any).template_id) {
      res.status(400).json({ error: "template_id is not set" })
      return
    }

    const updated = await service.updateMarketingCampaigns({
      id,
      status: "scheduled",
      send_at: new Date(),
    })

    res.json({ campaign: updated })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
