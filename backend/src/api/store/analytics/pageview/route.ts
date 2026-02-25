import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"
import { parseUserAgent } from "../../../../modules/analytics/ua-parser"
import { randomUUID } from "crypto"

/**
 * POST /store/analytics/pageview
 *
 * Creates a PageView record and upserts the VisitorSession.
 * Returns { session_id, visitor_id } for the client to store.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const body = req.body as Record<string, any>
    const { project_id, page_url, page_path } = body

    if (!project_id || !page_url) {
      res.status(400).json({ error: "project_id and page_url are required" })
      return
    }

    const service = req.scope.resolve(
      ANALYTICS_MODULE
    ) as unknown as AnalyticsModuleService

    // Extract server-side data
    const clientIp =
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      (req as any).ip ||
      ""
    const userAgent = (req.headers["user-agent"] as string) || ""
    const ua = parseUserAgent(userAgent)

    // Country from headers (Railway/Cloudflare)
    const country =
      (req.headers["cf-ipcountry"] as string) ||
      (req.headers["x-vercel-ip-country"] as string) ||
      body.country ||
      null

    // Generate IDs if not provided (new visitor/session)
    const visitorId = body.visitor_id || randomUUID()
    const sessionId = body.session_id || randomUUID()

    // Classify traffic source from UTM or referrer
    const trafficSource = classifyTrafficSource(body)

    // Create PageView
    await service.createPageViews({
      project_id,
      session_id: sessionId,
      visitor_id: visitorId,
      page_url,
      page_path: page_path || "/",
      referrer: body.referrer || null,
      utm_source: body.utm_source || null,
      utm_medium: body.utm_medium || null,
      utm_campaign: body.utm_campaign || null,
      utm_content: body.utm_content || null,
      utm_term: body.utm_term || null,
      traffic_source: trafficSource.source,
      traffic_medium: trafficSource.medium,
      device_type: ua.device_type,
      browser: ua.browser,
      os: ua.os,
      country,
      ip_address: clientIp,
      fbclid: body.fbclid || null,
      fbc: body.fbc || null,
      fbp: body.fbp || null,
    })

    // Upsert VisitorSession
    const existingSessions = await service.listVisitorSessions({
      session_id: sessionId,
    })

    if (existingSessions.length > 0) {
      // Update existing session
      const session = existingSessions[0] as any
      await service.updateVisitorSessions({
        id: session.id,
        last_page_url: page_url,
        pages_viewed: (session.pages_viewed || 0) + 1,
        is_bounce: false,
      })
    } else {
      // Create new session
      await service.createVisitorSessions({
        project_id,
        visitor_id: visitorId,
        session_id: sessionId,
        first_page_url: page_url,
        last_page_url: page_url,
        utm_source: body.utm_source || null,
        utm_medium: body.utm_medium || null,
        utm_campaign: body.utm_campaign || null,
        utm_content: body.utm_content || null,
        utm_term: body.utm_term || null,
        traffic_source: trafficSource.source,
        traffic_medium: trafficSource.medium,
        device_type: ua.device_type,
        browser: ua.browser,
        os: ua.os,
        country,
      })
    }

    res.json({ session_id: sessionId, visitor_id: visitorId })
  } catch (error: any) {
    console.error("[Analytics] Pageview error:", error)
    res.status(500).json({ error: error.message })
  }
}

function classifyTrafficSource(body: Record<string, any>): {
  source: string
  medium: string
} {
  // UTM params have highest priority
  if (body.utm_source) {
    const src = body.utm_source.toLowerCase()
    let source = body.utm_source
    if (src.includes("facebook") || src.includes("fb") || src.includes("ig") || src.includes("instagram")) {
      source = "facebook"
    } else if (src.includes("google")) {
      source = "google"
    } else if (src.includes("email") || src.includes("mail") || src.includes("resend") || src.includes("newsletter")) {
      source = "email"
    } else if (src.includes("tiktok")) {
      source = "tiktok"
    }
    return { source, medium: body.utm_medium || "none" }
  }

  // fbclid present = Facebook ad click
  if (body.fbclid) {
    return { source: "facebook", medium: "cpc" }
  }

  // Classify by referrer
  const referrer = (body.referrer || "").toLowerCase()
  if (!referrer) return { source: "direct", medium: "none" }

  if (referrer.includes("facebook.com") || referrer.includes("fb.com"))
    return { source: "facebook", medium: "social" }
  if (referrer.includes("instagram.com"))
    return { source: "instagram", medium: "social" }
  if (referrer.includes("google."))
    return { source: "google", medium: "organic" }
  if (referrer.includes("bing.com"))
    return { source: "bing", medium: "organic" }
  if (referrer.includes("t.co") || referrer.includes("twitter.com") || referrer.includes("x.com"))
    return { source: "twitter", medium: "social" }

  return { source: "referral", medium: "referral" }
}
