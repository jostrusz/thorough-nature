import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"
import { verifyToken } from "../../../../../modules/marketing/utils/tokens"

/**
 * Tracking pixel: GET /public/marketing/o/:token
 * Always returns a 1x1 transparent GIF (so broken tokens still look "fine"
 * to the receiving email client and never leak errors to third parties).
 */
const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
)

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const token = String((req.params as any).token || "")
  const payload = verifyToken(token, "pixel")

  if (payload?.m && payload?.b) {
    try {
      const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
      const [msg] = await service.listMarketingMessages({ id: payload.m })
      if (msg) {
        const now = new Date()
        await service.updateMarketingMessages({
          id: msg.id,
          first_opened_at: (msg as any).first_opened_at ?? now,
          opens_count: ((msg as any).opens_count ?? 0) + 1,
          status: (msg as any).status === "sent" || (msg as any).status === "delivered" ? "opened" : (msg as any).status,
        } as any)
        await service.createMarketingEvents({
          brand_id: payload.b,
          contact_id: (msg as any).contact_id,
          email: (msg as any).to_email,
          type: "email_opened",
          payload: { message_id: msg.id, user_agent: req.headers["user-agent"] },
          occurred_at: now,
          source: "tracking_pixel",
        } as any)
      }
    } catch {
      // swallow — tracking must never break the pixel
    }
  }

  res.setHeader("Content-Type", "image/gif")
  res.setHeader("Content-Length", String(TRANSPARENT_GIF.length))
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
  res.setHeader("Pragma", "no-cache")
  res.status(200).end(TRANSPARENT_GIF)
}
