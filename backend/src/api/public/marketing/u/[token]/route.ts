import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../../modules/marketing"
import type MarketingModuleService from "../../../../../modules/marketing/service"
import { verifyToken } from "../../../../../modules/marketing/utils/tokens"
import { hashEmail } from "../../../../../modules/marketing/utils/crypto"
import { getStrings, type UnsubStrings } from "../../../../../modules/marketing/utils/unsubscribe-i18n"

/**
 * Unsubscribe endpoint.
 *
 * GET  /public/marketing/u/:token  → human confirmation page (HTML)
 * POST /public/marketing/u/:token  → RFC 8058 one-click unsubscribe
 *
 * The POST form is also what Gmail/Apple Mail's native "Unsubscribe" button
 * hits when List-Unsubscribe and List-Unsubscribe-Post headers are present.
 *
 * All user-facing copy is localized via the brand's `locale` field
 * (cs/sk/hu/nl/de/pl/en supported, falls back to en).
 */

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function loadBrandLocale(req: MedusaRequest, brandId: string | null): Promise<string | null> {
  if (!brandId) return null
  try {
    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const [brand] = await service.listMarketingBrands({ id: brandId })
    return (brand as any)?.locale ?? null
  } catch {
    return null
  }
}

async function unsubscribe(
  req: MedusaRequest,
  token: string
): Promise<{ ok: boolean; brandId?: string; contactEmail?: string; locale?: string | null; error?: string }> {
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
    const [brand] = await service.listMarketingBrands({ id: payload.b })
    const locale = (brand as any)?.locale ?? null
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
    return { ok: true, brandId: payload.b, contactEmail: email, locale }
  } catch (err: any) {
    return { ok: false, error: err?.message || "internal_error" }
  }
}

function renderConfirmPage(t: UnsubStrings): string {
  return (
    `<!DOCTYPE html>\n` +
    `<html><head><meta charset="utf-8"><title>${escapeHtml(t.page_title_confirm)}</title>` +
    `<meta name="viewport" content="width=device-width,initial-scale=1"></head>` +
    `<body style="font-family: system-ui, -apple-system, sans-serif; max-width: 480px; margin: 60px auto; padding: 24px; color:#111">` +
    `<h2 style="font-size:22px;margin:0 0 12px">${escapeHtml(t.heading_confirm)}</h2>` +
    `<p style="line-height:1.55;color:#444">${escapeHtml(t.body_confirm)}</p>` +
    `<form method="POST" action="">` +
    `<button type="submit" style="background:#D92D20;color:white;padding:12px 24px;border:0;border-radius:6px;cursor:pointer;font-size:15px">${escapeHtml(t.button_confirm)}</button>` +
    `</form>` +
    `</body></html>`
  )
}

function renderSuccessPage(t: UnsubStrings, email: string): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(t.page_title_success)}</title>` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:80px auto;padding:24px;color:#111}h1{font-size:24px;margin:0 0 12px}p{line-height:1.55;color:#444}</style>` +
    `</head><body><h1>${escapeHtml(t.heading_success)}</h1>` +
    `<p>${escapeHtml(t.body_success(email))}</p></body></html>`
  )
}

function renderErrorPage(t: UnsubStrings): string {
  return (
    `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(t.page_title_error)}</title>` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<style>body{font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:80px auto;padding:24px;color:#111}p{line-height:1.55;color:#444}</style>` +
    `</head><body>` +
    `<p>${escapeHtml(t.body_error)}</p>` +
    `</body></html>`
  )
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
    const t = getStrings(null)
    res.status(400).send(renderErrorPage(t))
    return
  }
  const locale = await loadBrandLocale(req, payload.b)
  const t = getStrings(locale)
  res.status(200).send(renderConfirmPage(t))
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const token = String((req.params as any).token || "")
  const result = await unsubscribe(req, token)
  // If the POST came from the HTML form (browser), render a friendly page.
  // Otherwise (e.g. RFC 8058 one-click machine POST from Gmail/Apple Mail),
  // a minimal text body is fine.
  const accept = String(req.headers["accept"] || "")
  const wantsHtml = accept.includes("text/html")
  const t = getStrings(result.locale ?? null)
  if (wantsHtml) {
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    if (result.ok) {
      res.status(200).send(renderSuccessPage(t, result.contactEmail ?? ""))
    } else {
      res.status(400).send(renderErrorPage(t))
    }
    return
  }
  if (result.ok) {
    res.status(200).send(t.text_unsubscribed)
  } else {
    res.status(400).send(`Error: ${result.error || "invalid"}`)
  }
}
