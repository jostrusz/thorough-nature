import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * GET /admin/analytics/traffic-sources?project_id=xxx&period=7d
 *
 * Returns per-source: visitors, conversion rate, revenue, orders.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const service = req.scope.resolve(
      ANALYTICS_MODULE
    ) as unknown as AnalyticsModuleService

    const projectId = (req.query.project_id as string) || undefined
    const period = (req.query.period as string) || "7d"
    const days = period === "30d" ? 30 : period === "14d" ? 14 : 7
    const periodStart = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000
    )

    const baseFilter: Record<string, any> = {}
    if (projectId) baseFilter.project_id = projectId

    const allSessions = await service.listVisitorSessions(baseFilter, {
      take: 10000,
    })

    const currentSessions = allSessions.filter(
      (s: any) => new Date(s.created_at) >= periodStart
    )

    // Get purchase events for revenue
    const purchaseEvents = await service.listConversionEvents(
      { ...baseFilter, event_type: "purchase" },
      { take: 10000 }
    )
    const currentPurchases = purchaseEvents.filter(
      (e: any) => new Date(e.created_at) >= periodStart
    )

    // Build revenue map by session_id
    const revenueBySession: Record<string, number> = {}
    for (const e of currentPurchases) {
      const ev = e as any
      revenueBySession[ev.session_id] =
        (revenueBySession[ev.session_id] || 0) +
        ((ev.event_data as any)?.value || 0)
    }

    // Group sessions by traffic_source
    const sourceMap: Record<
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
      const source = sess.traffic_source || "direct"

      if (!sourceMap[source]) {
        sourceMap[source] = {
          visitors: new Set(),
          sessions: 0,
          conversions: 0,
          revenue: 0,
        }
      }

      sourceMap[source].visitors.add(sess.visitor_id)
      sourceMap[source].sessions++
      if (sess.has_conversion) {
        sourceMap[source].conversions++
        sourceMap[source].revenue += revenueBySession[sess.session_id] || 0
      }
    }

    const sources = Object.entries(sourceMap)
      .map(([source, data]) => ({
        source,
        visitors: data.visitors.size,
        sessions: data.sessions,
        orders: data.conversions,
        conversion_rate:
          data.sessions > 0
            ? Math.round((data.conversions / data.sessions) * 10000) / 100
            : 0,
        revenue: data.revenue,
      }))
      .sort((a, b) => b.visitors - a.visitors)

    res.json({ sources, period, days })
  } catch (error: any) {
    console.error("[Analytics Admin] Traffic sources error:", error)
    res.status(500).json({ error: error.message })
  }
}
