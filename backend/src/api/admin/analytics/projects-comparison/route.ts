import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * GET /admin/analytics/projects-comparison?period=7d
 *
 * Returns per-project: visitors, orders, conversion rate, revenue.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const service = req.scope.resolve(
      ANALYTICS_MODULE
    ) as unknown as AnalyticsModuleService

    const period = (req.query.period as string) || "7d"
    const days = period === "30d" ? 30 : period === "14d" ? 14 : 7
    const periodStart = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    )

    // Get all sessions
    const allSessions = await service.listVisitorSessions(
      {},
      { take: 10000 }
    )
    const currentSessions = allSessions.filter(
      (s: any) => new Date(s.created_at) >= periodStart
    )

    // Get purchase events for revenue
    const purchaseEvents = await service.listConversionEvents(
      { event_type: "purchase" },
      { take: 10000 }
    )
    const currentPurchases = purchaseEvents.filter(
      (e: any) => new Date(e.created_at) >= periodStart
    )

    // Revenue by session
    const revenueBySession: Record<string, number> = {}
    for (const e of currentPurchases) {
      const ev = e as any
      revenueBySession[ev.session_id] =
        (revenueBySession[ev.session_id] || 0) +
        ((ev.event_data as any)?.value || 0)
    }

    // Group by project
    const projectMap: Record<
      string,
      {
        visitors: Set<string>
        sessions: number
        conversions: number
        revenue: number
      }
    > = {}

    for (const s of currentSessions) {
      const sess = s as any
      const pid = sess.project_id || "unknown"

      if (!projectMap[pid]) {
        projectMap[pid] = {
          visitors: new Set(),
          sessions: 0,
          conversions: 0,
          revenue: 0,
        }
      }

      projectMap[pid].visitors.add(sess.visitor_id)
      projectMap[pid].sessions++
      if (sess.has_conversion) {
        projectMap[pid].conversions++
        projectMap[pid].revenue += revenueBySession[sess.session_id] || 0
      }
    }

    const projects = Object.entries(projectMap)
      .map(([project_id, data]) => ({
        project_id,
        visitors: data.visitors.size,
        sessions: data.sessions,
        orders: data.conversions,
        conversion_rate:
          data.sessions > 0
            ? Math.round((data.conversions / data.sessions) * 10000) / 100
            : 0,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)

    res.json({ projects, period, days })
  } catch (error: any) {
    console.error("[Analytics Admin] Projects comparison error:", error)
    res.status(500).json({ error: error.message })
  }
}
