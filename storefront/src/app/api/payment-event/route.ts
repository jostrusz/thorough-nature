import { NextRequest, NextResponse } from "next/server"

/**
 * Same-origin proxy for /public/payment-event on the Medusa backend.
 *
 * Why this exists:
 *   Browsers blocked by DNS-level ad/tracking blockers (Pi-hole, AdGuard,
 *   Brave Shields, NextDNS) can't reach marketing-hq.eu directly. But they
 *   can always reach the storefront's own origin. This route receives the
 *   event from the browser and forwards server-to-server to the backend,
 *   so telemetry gets through even when cross-origin is blocked.
 *
 * Fire-and-forget by design — we return 204 immediately. Even if the
 * backend is unreachable we don't fail the checkout flow.
 */
const BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL ||
  process.env.MEDUSA_BACKEND_URL ||
  "http://localhost:9000"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({} as any))
    if (!body || !body.event_type) {
      return new NextResponse(null, { status: 204 })
    }

    const ua = req.headers.get("user-agent") || ""
    const ref = req.headers.get("referer") || ""
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      ""

    const payload = {
      ...body,
      user_agent: body.user_agent || ua,
      referrer: body.referrer || ref,
      // IP is supplied by the backend route itself from headers; pass our
      // downstream-observed client IP here so the backend stores the real
      // browser IP, not this proxy's container IP.
    }

    // Fire-and-forget — 3s budget, do not await response body
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 3000)
    fetch(`${BACKEND_URL}/public/payment-event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(() => clearTimeout(t))
      .catch(() => clearTimeout(t))

    return new NextResponse(null, { status: 204 })
  } catch {
    // Never break the checkout on telemetry errors
    return new NextResponse(null, { status: 204 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
