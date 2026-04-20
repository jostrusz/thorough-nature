// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"
import { RecipientResolver } from "../../../../../../modules/marketing/utils/recipient-resolver"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id
    const body = (req.body as any) || {}

    const [campaign] = await service.listMarketingCampaigns({ id })
    if (!campaign) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const c = campaign as any
    const hasInline = !!(c.subject && c.custom_html)
    const hasTemplate = !!c.template_id
    if (!hasInline && !hasTemplate) {
      res.status(400).json({ error: "campaign has no subject/custom_html and no template_id" })
      return
    }
    if (hasInline && !c.from_email) {
      res.status(400).json({ error: "from_email is required" })
      return
    }

    const resolver = new RecipientResolver()
    const count = await resolver.count({
      brandId: (campaign as any).brand_id,
      listId: (campaign as any).list_id,
      segmentId: (campaign as any).segment_id,
      suppressionSegmentIds: (campaign as any).suppression_segment_ids,
    })

    if (count === 0) {
      res.status(400).json({ error: "no_recipients" })
      return
    }

    const sendAt = body.send_at ? new Date(body.send_at) : (campaign as any).send_at || new Date()

    const updated = await service.updateMarketingCampaigns({
      id,
      status: "scheduled",
      send_at: sendAt,
    })

    res.json({ campaign: updated, recipient_count: count })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
