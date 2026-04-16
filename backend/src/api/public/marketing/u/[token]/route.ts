import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"
import { verifyToken } from "../../../../../modules/marketing/utils/tokens"
import { hashEmail } from "../../../../../modules/marketing/utils/crypto"

/**
 * Unsubscribe endpoint.
 *
 * GET  /public/marketing/u/:token  → human confirmation page (HTML)
 * POST /public/marketing/u/:token  → RFC 8058 one-click unsubscribe
 *
 * The POST form is also what Gmail/Apple Mail's native "Unsubscribe" button
 * hits when List-Unsubscribe and List-Unsubscribe-Post headers are present.
 */

async function unsubscribe(req: MedusaRequest, token: string): Promise<{ ok: boolean; brandId?: string; contactEmail?: string; error?: string }> {
  const payload = verifyToken(token, "unsub")
  if (!payload?.b || !payload?.c) {
    return { ok: false, error: "invalid_token" }
  }
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const [contact] = await service.listMarketingContacts({ id: payload.c })
    if (!contact || (contact as any).brand_id !== payload.b) {
      return { ok: false, error: "not_found" }
    }
    const email = (contact as any).email as string
    const now = new Date()
    await service.updateMarketingContacts({
      id: contact.id,
      status: "unsubscribed",
      unsubscribed_at: now,
    } as any)
    await service.createMarketingSuppressions({
      brand_id: payload.b,
      email,
      reason: "unsubscribed",
      suppressed_at: now,
    } as any)
    await service.createMarketingConsentLogs({
      brand_id: payload.b,
      contact_id: contact.id,
      email,
      email_hash: hashEmail(email),
      action: "unsubscribed",
      source: "unsubscribe_link",
      ip_address: (req.headers["x-forwarded-for"] as string)?.split(",")[0] || (req as any).ip || null,
      user_agent: (req.headers["user-agent"] as string) || null,
      occurred_at: now,
    } as any)
    return { ok: true, brandId: payload.b, contactEmail: email }
  } catch (err: any) {
    return { ok: false, error: err?.message || "internal_error" }
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const token = String((req.params as any).token || "")
  // IMPORTANT: GET must NOT mutate state. Mail scanners (Outlook SafeLinks,
  // corporate proxies) routinely prefetch every link in an email, which
  // would otherwise cause false unsubscribes. Validate the token and render
  // a confirmation page whose button POSTs back to this same URL.
  const payload = verifyToken(token, "unsub")
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  if (!payload?.b || !payload?.c) {
    res.status(400).send(
      `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe error</title></head><body>` +
        `<p>This unsubscribe link is no longer valid. If you want to stop receiving emails, please reply to any previous message and we'll remove you manually.</p>` +
        `</body></html>`
    )
    return
  }
  res.status(200).send(
    `<!DOCTYPE html>\n` +
      `<html><head><meta charset="utf-8"><title>Unsubscribe</title>` +
      `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
      `<body style="font-family: system-ui; max-width: 480px; margin: 60px auto; padding: 24px">` +
      `<h2>Unsubscribe from emails</h2>` +
      `<p>Click the button below to confirm you want to stop receiving emails.</p>` +
      `<form method="POST" action="">` +
      `<button type="submit" style="background:#D92D20;color:white;padding:12px 24px;border:0;border-radius:6px;cursor:pointer;font-size:15px">Confirm unsubscribe</button>` +
      `</form>` +
      `</body></html>`
  )
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const token = String((req.params as any).token || "")
  const result = await unsubscribe(req, token)
  // If the POST came from the HTML form (browser), render a friendly page.
  // Otherwise (e.g. RFC 8058 one-click machine POST from Gmail/Apple Mail),
  // a minimal text body is fine.
  const accept = String(req.headers["accept"] || "")
  const wantsHtml = accept.includes("text/html")
  if (wantsHtml) {
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    if (result.ok) {
      res.status(200).send(
        `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribed</title>` +
          `<meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:80px auto;padding:24px;color:#111}h1{font-size:24px;margin:0 0 12px}p{line-height:1.55;color:#444}</style>` +
          `</head><body><h1>You have been unsubscribed.</h1>` +
          `<p>${result.contactEmail ?? ""} will no longer receive marketing emails from us. ` +
          `If this was a mistake, just reply to any previous email to let us know.</p></body></html>`
      )
    } else {
      res.status(400).send(
        `<!doctype html><html><head><meta charset="utf-8"><title>Unsubscribe error</title></head><body>` +
          `<p>This unsubscribe link is no longer valid. If you want to stop receiving emails, please reply to any previous message and we'll remove you manually.</p>` +
          `</body></html>`
      )
    }
    return
  }
  if (result.ok) {
    res.status(200).send("Unsubscribed")
  } else {
    res.status(400).send(`Error: ${result.error || "invalid"}`)
  }
}
