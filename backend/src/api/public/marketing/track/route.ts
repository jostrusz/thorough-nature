// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MARKETING_MODULE } from "../../../../modules/marketing"
import type MarketingModuleService from "../../../../modules/marketing/service"
import { hashEmail } from "../../../../modules/marketing/utils/crypto"

/**
 * Public tracking endpoint
 * ────────────────────────
 * POST /public/marketing/track
 * Body: { brand_slug, email?, event_type, properties? }
 *
 * Called by the storefront JS snippet for on-site behavior signals:
 *   - page_viewed
 *   - product_viewed
 *   - subscribed_via_form
 *   - form_submitted
 *
 * CORS: already allowed from /api/middlewares.ts for /public/*.
 * Rate limit: 60 requests / minute / IP (in-memory Map, fine for single node).
 * Response: 204 No Content on success.
 */

const ALLOWED_EVENTS = new Set([
  "page_viewed",
  "product_viewed",
  "subscribed_via_form",
  "form_submitted",
])

// ── Rate limit bucket: ip → { count, resetAt } ──
const RATE_WINDOW_MS = 60 * 1000
const RATE_MAX = 60
const rateBuckets: Map<string, { count: number; resetAt: number }> = new Map()

function rateLimit(ip: string): boolean {
  const now = Date.now()
  const bucket = rateBuckets.get(ip)
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS })
    // Best-effort cleanup so the map doesn't grow unbounded
    if (rateBuckets.size > 5000) {
      for (const [k, v] of rateBuckets) {
        if (v.resetAt <= now) rateBuckets.delete(k)
      }
    }
    return true
  }
  if (bucket.count >= RATE_MAX) return false
  bucket.count++
  return true
}

function clientIp(req: MedusaRequest): string {
  const fwd = (req.headers["x-forwarded-for"] as string) || ""
  if (fwd) return fwd.split(",")[0].trim()
  return (req as any).ip || (req.socket as any)?.remoteAddress || "unknown"
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const logger = (req.scope.resolve("logger") as any) || console
  const ip = clientIp(req)

  if (!rateLimit(ip)) {
    res.status(429).json({ error: "rate_limited" })
    return
  }

  try {
    const body = (req.body || {}) as any
    const brandSlug = String(body.brand_slug || "").trim()
    const eventType = String(body.event_type || "").trim()
    const rawEmail = body.email ? String(body.email).trim().toLowerCase() : null
    const properties = body.properties && typeof body.properties === "object" ? body.properties : {}

    if (!brandSlug || !eventType) {
      res.status(400).json({ error: "missing_fields" })
      return
    }
    if (!ALLOWED_EVENTS.has(eventType)) {
      res.status(400).json({ error: "unsupported_event" })
      return
    }

    const service = req.scope.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

    const [brand] = (await service.listMarketingBrands({ slug: brandSlug } as any)) as any[]
    if (!brand || brand.enabled === false) {
      // Respond 204 anyway — we don't want to leak brand existence to the public
      res.status(204).end()
      return
    }

    // Optional contact upsert — only if email is provided
    let contactId: string | null = null
    if (rawEmail) {
      const existing = (await service.listMarketingContacts({
        brand_id: brand.id,
        email: rawEmail,
      } as any)) as any[]
      if (existing?.[0]) {
        contactId = existing[0].id
      } else {
        const status = brand.double_opt_in_enabled ? "unconfirmed" : "subscribed"
        const created = await service.createMarketingContacts({
          brand_id: brand.id,
          email: rawEmail,
          status,
          source: properties.source || "track",
          consent_ip: ip,
          consent_user_agent: (req.headers["user-agent"] as string) || null,
          consent_at: status === "subscribed" ? new Date() : null,
        } as any)
        contactId = (created as any).id

        // If we auto-subscribed, log it
        if (status === "subscribed") {
          try {
            await service.createMarketingConsentLogs({
              brand_id: brand.id,
              contact_id: contactId,
              email: rawEmail,
              email_hash: hashEmail(rawEmail),
              action: "subscribed",
              source: `track:${eventType}`,
              ip_address: ip,
              user_agent: (req.headers["user-agent"] as string) || null,
              occurred_at: new Date(),
            } as any)
          } catch {}
        }
      }
    }

    await service.createMarketingEvents({
      brand_id: brand.id,
      contact_id: contactId,
      email: rawEmail,
      type: eventType,
      payload: {
        ...properties,
        ip,
        user_agent: (req.headers["user-agent"] as string) || null,
      },
      occurred_at: new Date(),
      source: "public:track",
    } as any)

    res.status(204).end()
  } catch (err: any) {
    logger.warn(`[Marketing Tracking] track error: ${err?.message || err}`)
    // Return 204 anyway — a broken tracking pixel must never break the page
    res.status(204).end()
  }
}

// Handle CORS preflight explicitly as well (global middleware already covers
// /public/* but we keep this for safety).
export async function OPTIONS(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.status(204).end()
}
