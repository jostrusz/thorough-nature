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

    const c = campaign as any
    // Transition guard: only a paused campaign can be resumed.
    if (String(c.status) !== "paused") {
      res.status(400).json({ error: `cannot resume campaign in status '${c.status}'` })
      return
    }

    // Re-arm for the dispatcher: back to 'scheduled' with send_at = now so the
    // next cron tick picks it up and finishes the remaining recipients. The
    // dispatcher is idempotent (already-sent rows are skipped via the
    // UNIQUE/done-status filter), so this safely delivers only the rest.
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
