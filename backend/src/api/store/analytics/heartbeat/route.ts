import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * POST /store/analytics/heartbeat
 *
 * Updates time_on_page and scroll_depth on the most recent PageView
 * for the given session, and updates session duration.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const body = req.body as Record<string, any>
    const { session_id, time_on_page, scroll_depth } = body

    if (!session_id) {
      res.status(400).json({ error: "session_id is required" })
      return
    }

    const service = req.scope.resolve(
      ANALYTICS_MODULE
    ) as unknown as AnalyticsModuleService

    // Find the latest PageView for this session and update it
    const pageViews = await service.listPageViews(
      { session_id },
      { order: { created_at: "DESC" }, take: 1 }
    )

    if (pageViews.length > 0) {
      const pv = pageViews[0] as any
      await service.updatePageViews({
        id: pv.id,
        time_on_page: Math.max(pv.time_on_page || 0, time_on_page || 0),
        scroll_depth: Math.max(pv.scroll_depth || 0, scroll_depth || 0),
      })
    }

    // Update session duration
    const sessions = await service.listVisitorSessions({ session_id })
    if (sessions.length > 0) {
      const session = sessions[0] as any
      await service.updateVisitorSessions({
        id: session.id,
        duration_seconds: Math.max(
          session.duration_seconds || 0,
          time_on_page || 0
        ),
      })
    }

    res.json({ success: true })
  } catch (error: any) {
    // Don't log heartbeat errors — they're high-frequency
    res.status(500).json({ error: error.message })
  }
}
