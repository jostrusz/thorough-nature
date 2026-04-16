import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"
import { verifyToken } from "../../../../../modules/marketing/utils/tokens"

/**
 * Click redirect: GET /public/marketing/c/:token
 * Token payload.u is the target URL (signed so it can't be rewritten).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const token = String((req.params as any).token || "")
  const payload = verifyToken(token, "click")

  if (!payload?.u) {
    res.status(400).send("Invalid link")
    return
  }

  // Validate redirect target: only allow http(s) schemes. Reject javascript:,
  // data:, file:, or anything else that could be used for XSS/phishing if
  // an attacker ever managed to mint a signed token with a malicious URL.
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

  // Record the click (best-effort)
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
        await service.createMarketingEvents({
          brand_id: payload.b,
          contact_id: (msg as any).contact_id,
          email: (msg as any).to_email,
          type: "email_clicked",
          payload: { message_id: msg.id, url: payload.u, user_agent: req.headers["user-agent"] },
          occurred_at: now,
          source: "click_tracker",
        } as any)
      }
    } catch {
      // swallow
    }
  }

  res.redirect(302, payload.u)
}
