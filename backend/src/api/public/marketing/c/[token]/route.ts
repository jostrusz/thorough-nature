import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"
import { verifyToken } from "../../../../../modules/marketing/utils/tokens"

/**
 * Click redirect: GET /public/marketing/c/:token
 *
 * Click tracking here serves two purposes:
 *   1. Analytics (opens/clicks counters on marketing_message).
 *   2. Attribution — the marketing_event row with type='email_clicked' for
 *      this (brand_id, contact_id) is what the order.placed subscriber reads
 *      to create a marketing_attribution row inside a 30-day last-click
 *      window. No cookie needed: contact_id is on both sides of the join.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const token = String((req.params as any).token || "")
  const payload = verifyToken(token, "click")

  if (!payload?.u) {
    res.status(400).send("Invalid link")
    return
  }

  try {
    const target = new URL(payload.u)
    if (target.protocol !== "http:" && target.protocol !== "https:") {
      res.status(400).send("Invalid redirect target")
      return
    }
  } catch {
    res.status(400).send("Invalid redirect target")
    return
  }

  if (payload.m && payload.b) {
    try {
      const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
      const [msg] = await service.listMarketingMessages({ id: payload.m })
      if (msg) {
        const now = new Date()
        await service.updateMarketingMessages({
          id: msg.id,
          first_clicked_at: (msg as any).first_clicked_at ?? now,
          clicks_count: ((msg as any).clicks_count ?? 0) + 1,
          status:
            (msg as any).status === "sent" ||
            (msg as any).status === "delivered" ||
            (msg as any).status === "opened"
              ? "clicked"
              : (msg as any).status,
        } as any)
        // Event row — the attribution system reads this on order.placed
        await service.createMarketingEvents({
          brand_id: payload.b,
          contact_id: (msg as any).contact_id,
          email: (msg as any).to_email,
          type: "email_clicked",
          payload: {
            message_id: msg.id,
            campaign_id: (msg as any).campaign_id || null,
            flow_id: (msg as any).flow_id || null,
            flow_run_id: (msg as any).flow_run_id || null,
            url: payload.u,
            user_agent: req.headers["user-agent"],
          },
          occurred_at: now,
          source: "click_tracker",
        } as any)
      }
    } catch {
      // swallow — click tracking must never break the redirect
    }
  }

  res.redirect(302, payload.u)
}
