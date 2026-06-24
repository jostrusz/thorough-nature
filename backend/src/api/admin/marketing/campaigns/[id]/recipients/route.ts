// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"
import { RecipientResolver } from "../../../../../../modules/marketing/utils/recipient-resolver"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id

    const [campaign] = await service.listMarketingCampaigns({ id })
    if (!campaign) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const c = campaign as any
    const resolver = new RecipientResolver()
    const recipients = await resolver.resolve({
      brandId: c.brand_id,
      listIds: Array.isArray(c.list_ids) ? c.list_ids : undefined,
      listId: c.list_id,
      segmentIds: Array.isArray(c.segment_ids) ? c.segment_ids : undefined,
      segmentId: c.segment_id,
      suppressionSegmentIds: c.suppression_segment_ids,
    })

    res.json({
      count: recipients.length,
      sample: recipients.slice(0, 100).map((r: any) => r.email),
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
