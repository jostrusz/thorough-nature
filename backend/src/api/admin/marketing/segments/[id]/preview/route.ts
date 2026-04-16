// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"
import { RecipientResolver } from "../../../../../../modules/marketing/utils/recipient-resolver"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const id = (req.params as any).id

    const [segment] = await service.listMarketingSegments({ id })
    if (!segment) {
      res.status(404).json({ error: "not_found" })
      return
    }

    const resolver = new RecipientResolver()
    const recipients = await resolver.resolve({
      brandId: (segment as any).brand_id,
      segmentId: id,
    })

    const count = recipients.length
    const firstEmails = recipients.slice(0, 100).map((r: any) => r.email)

    try {
      await service.updateMarketingSegments({
        id,
        cached_count: count,
        cached_at: new Date(),
      })
    } catch (e) {
      // cache update failure should not break the preview response
    }

    res.json({ count, first_100_emails: firstEmails })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
