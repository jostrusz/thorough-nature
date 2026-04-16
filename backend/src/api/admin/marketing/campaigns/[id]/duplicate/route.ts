// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../modules/marketing/service"

/**
 * POST /admin/marketing/campaigns/:id/duplicate
 * Creates a draft copy of the campaign. Status forced to 'draft', sent_at
 * cleared, metrics cleared, template_version reset.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = String((req.params as any).id || "")
  if (!id) {
    res.status(400).json({ error: "missing_id" })
    return
  }
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const [src] = await service.listMarketingCampaigns({ id } as any)
    if (!src) {
      res.status(404).json({ error: "not_found" })
      return
    }
    const copy = await service.createMarketingCampaigns({
      brand_id: (src as any).brand_id,
      name: `${(src as any).name} (copy)`,
      template_id: (src as any).template_id,
      template_version: null,
      list_id: (src as any).list_id,
      segment_id: (src as any).segment_id,
      suppression_segment_ids: (src as any).suppression_segment_ids,
      status: "draft",
      send_at: null,
      sent_at: null,
      metrics: null,
      ab_test: (src as any).ab_test,
    } as any)
    res.json({ campaign: copy })
  } catch (e: any) {
    res.status(500).json({ error: e.message })
  }
}
