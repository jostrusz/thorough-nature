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

    const resolver = new RecipientResolver()
    const recipients = await resolver.resolve({
      brandId: (campaign as any).brand_id,
      listId: (campaign as any).list_id,
      segmentId: (campaign as any).segment_id,
      suppressionSegmentIds: (campaign as any).suppression_segment_ids,
    })

    res.json({
      count: recipients.length,
      recipients: recipients.slice(0, 100).map((r: any) => ({
        id: r.id,
        email: r.email,
        first_name: r.first_name,
      })),
    })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
