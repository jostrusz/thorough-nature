// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { logPaymentEvent } from "../../../modules/payment-debug/utils/log"

/**
 * POST /public/payment-event
 *
 * Called from the storefront's Next.js API proxy (same-origin, adblocker-safe).
 * Never from the browser directly — we rely on the storefront to server-to-
 * server POST here so browser-level tracking blockers can't sabotage the
 * telemetry.
 *
 * Rate-limited per-IP so a malicious actor can't spam the table.
 *
 * Body (free-form, all optional except event_type):
 *   { event_type, intent_id?, cart_id?, email?, project_slug?,
 *     event_data?: object, error_code?, user_agent?, referrer?, occurred_at? }
 */

const WINDOW_MS = 60 * 1000
const MAX_PER_IP = 200         // generous — ~3/sec from one IP
const rate: Map<string, { count: number; resetAt: number }> = new Map()

function clientIp(req: MedusaRequest): string {
  const fwd = (req.headers["x-forwarded-for"] as string) || ""
  if (fwd) return fwd.split(",")[0].trim()
  return (req as any).ip || (req.socket as any)?.remoteAddress || "unknown"
}

function rateCheck(ip: string): boolean {
  const now = Date.now()
  const b = rate.get(ip)
  if (!b || b.resetAt <= now) {
    rate.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    // Opportunistic GC
    if (rate.size > 2000) {
      for (const [k, v] of rate) if (v.resetAt <= now) rate.delete(k)
    }
    return true
  }
  if (b.count >= MAX_PER_IP) return false
  b.count++
  return true
}

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const ip = clientIp(req)
  if (!rateCheck(ip)) {
    res.status(429).json({ error: "rate_limited" })
    return
  }

  const body = (req.body as any) || {}
  if (!body.event_type || typeof body.event_type !== "string") {
    res.status(400).json({ error: "event_type required" })
    return
  }

  await logPaymentEvent({
    intent_id: body.intent_id ?? null,
    cart_id: body.cart_id ?? null,
    email: body.email ?? null,
    project_slug: body.project_slug ?? null,
    event_type: String(body.event_type),
    event_data: body.event_data && typeof body.event_data === "object" ? body.event_data : null,
    error_code: body.error_code ?? null,
    user_agent: body.user_agent ?? (req.headers["user-agent"] as string) ?? null,
    referrer: body.referrer ?? (req.headers["referer"] as string) ?? null,
    ip_address: ip,
    occurred_at: body.occurred_at ? new Date(body.occurred_at) : undefined,
  })

  // 204 — no content, super-light response
  res.status(204).end()
}

export async function OPTIONS(_req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.status(204).end()
}
