// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../../../modules/marketing/service"

export async function DELETE(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const list_id = (req.params as any).id
    const contact_id = (req.params as any).contactId

    const existing = await service.listMarketingListMemberships({ list_id, contact_id })
    for (const m of existing) {
      await service.deleteMarketingListMemberships((m as any).id)
    }

    res.json({ ok: true })
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
