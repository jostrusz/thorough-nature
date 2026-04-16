import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import crypto from "crypto"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"

/**
 * Resend webhook endpoint for the MARKETING module only.
 *
 * Receives events:
 *   - email.sent, email.delivered
 *   - email.delivery_delayed
 *   - email.bounced (hard)   → add to suppression
 *   - email.complained       → add to suppression
 *   - email.opened, email.clicked (we use our own tracking, but accept these too)
 *
 * Signature verification: Resend signs webhooks with Svix-style headers.
 * We keep this tolerant (log and continue) so a shared webhook endpoint in
 * Resend doesn't break us during setup — but when MARKETING_RESEND_WEBHOOK_SECRET
 * is set, we enforce signature validation.
 */

function verifySignature(req: MedusaRequest, rawBody: string): boolean {
  const secret = process.env.MARKETING_RESEND_WEBHOOK_SECRET
  if (!secret) {
    // Fail-closed in production: a missing secret in prod is a misconfiguration
    // that would otherwise let anyone post fake webhook events. Allow only
    // during local development for setup convenience.
    if (process.env.NODE_ENV === "production") return false
    return true
  }

  const id = req.headers["svix-id"] as string | undefined
  const timestamp = req.headers["svix-timestamp"] as string | undefined
  const signatureHeader = req.headers["svix-signature"] as string | undefined
  if (!id || !timestamp || !signatureHeader) return false

  // Timestamp freshness check (5-minute window) to prevent replay attacks
  // on old/leaked signed payloads.
  const tsSeconds = Number(timestamp)
  if (!Number.isFinite(tsSeconds)) return false
  const skewMs = Math.abs(Date.now() - tsSeconds * 1000)
  if (skewMs > 5 * 60 * 1000) return false

  try {
    const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64")
    const signedPayload = `${id}.${timestamp}.${rawBody}`
    const expected = crypto.createHmac("sha256", secretBytes).update(signedPayload).digest("base64")
    // signatureHeader may contain multiple v1,signature pairs separated by spaces
    return signatureHeader
      .split(" ")
      .map((part) => part.trim().replace(/^v1,/, ""))
      .some((s) => s === expected)
  } catch {
    return false
  }
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const raw = (req as any).rawBody
  const rawBody: string =
    typeof raw === "string"
      ? raw
      : Buffer.isBuffer(raw)
      ? raw.toString("utf8")
      : JSON.stringify(req.body || {})

  if (!verifySignature(req, rawBody)) {
    res.status(401).json({ error: "invalid_signature" })
    return
  }

  const event = (req.body as any) || {}
  const type = event.type as string | undefined
  const data = event.data || {}
  const resendId: string | undefined = data.email_id || data.id
  const toEmail: string | undefined = Array.isArray(data.to) ? data.to[0] : data.to

  if (!type || !resendId) {
    res.status(200).json({ ok: true, ignored: true })
    return
  }

  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const [msg] = await service.listMarketingMessages({ resend_email_id: resendId } as any)
    if (!msg) {
      // Message not owned by marketing module (probably a transactional email
      // on the same shared webhook). Ignore silently.
      res.status(200).json({ ok: true, ignored: true })
      return
    }

    const now = new Date()
    const updates: Record<string, any> = { id: msg.id }

    switch (type) {
      case "email.sent":
        updates.status = (msg as any).status === "queued" ? "sent" : (msg as any).status
        updates.sent_at = (msg as any).sent_at ?? now
        break
      case "email.delivered":
        updates.status =
          (msg as any).status === "opened" || (msg as any).status === "clicked"
            ? (msg as any).status
            : "delivered"
        updates.delivered_at = now
        break
      case "email.bounced": {
        updates.status = "bounced"
        updates.bounced_at = now
        updates.bounce_reason = data.bounce?.type || data.reason || "hard_bounce"
        if (toEmail) {
          await service.createMarketingSuppressions({
            brand_id: (msg as any).brand_id,
            email: toEmail,
            reason: "bounced_hard",
            source_message_id: msg.id,
            suppressed_at: now,
            metadata: { bounce_type: updates.bounce_reason },
          } as any)
        }
        break
      }
      case "email.complained": {
        updates.status = "complained"
        updates.complained_at = now
        if (toEmail) {
          await service.createMarketingSuppressions({
            brand_id: (msg as any).brand_id,
            email: toEmail,
            reason: "complained",
            source_message_id: msg.id,
            suppressed_at: now,
          } as any)
        }
        break
      }
      case "email.opened":
        updates.first_opened_at = (msg as any).first_opened_at ?? now
        updates.opens_count = ((msg as any).opens_count ?? 0) + 1
        updates.status =
          (msg as any).status === "sent" || (msg as any).status === "delivered"
            ? "opened"
            : (msg as any).status
        break
      case "email.clicked":
        updates.first_clicked_at = (msg as any).first_clicked_at ?? now
        updates.clicks_count = ((msg as any).clicks_count ?? 0) + 1
        updates.status = "clicked"
        break
      default:
        // unknown event — accept but no update
        break
    }

    if (Object.keys(updates).length > 1) {
      await service.updateMarketingMessages(updates as any)
    }

    res.status(200).json({ ok: true })
  } catch (err: any) {
    // Resend retries on non-2xx. Log and return 500 only for unexpected errors.
    console.error("[marketing/resend webhook] error:", err?.message || err)
    res.status(500).json({ error: err?.message || "internal_error" })
  }
}
