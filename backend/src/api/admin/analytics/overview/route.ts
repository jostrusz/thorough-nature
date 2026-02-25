import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * GET /admin/analytics/overview?project_id=xxx&period=7d
 *
 * Returns visitors, conversion rate, revenue, CPA + period comparison.
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
    const now = new Date()
    const periodStart = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
    const prevPeriodStart = new Date(
      periodStart.getTime() - days * 24 * 60 * 60 * 1000
    )

    // Filters
    const baseFilter: Record<string, any> = {}
    if (projectId) baseFilter.project_id = projectId

    // Current period sessions
    const allSessions = await service.listVisitorSessions(baseFilter, {
      take: 10000,
    })
    const currentSessions = allSessions.filter(
      (s: any) => new Date(s.created_at) >= periodStart
    )
    const prevSessions = allSessions.filter(
      (s: any) =>
        new Date(s.created_at) >= prevPeriodStart &&
        new Date(s.created_at) < periodStart
    )

    // Unique visitors (by visitor_id)
    const currentVisitors = new Set(
      currentSessions.map((s: any) => s.visitor_id)
    ).size
    const prevVisitors = new Set(
      prevSessions.map((s: any) => s.visitor_id)
    ).size

    // Conversions
    const currentConversions = currentSessions.filter(
      (s: any) => s.has_conversion
    ).length
    const prevConversions = prevSessions.filter(
      (s: any) => s.has_conversion
    ).length

    const currentConvRate =
      currentSessions.length > 0
        ? (currentConversions / currentSessions.length) * 100
        : 0
    const prevConvRate =
      prevSessions.length > 0
        ? (prevConversions / prevSessions.length) * 100
        : 0

    // Revenue from conversion events
    const allEvents = await service.listConversionEvents(
      { ...baseFilter, event_type: "purchase" },
      { take: 10000 }
    )
    const currentRevenue = allEvents
      .filter((e: any) => new Date(e.created_at) >= periodStart)
      .reduce(
        (sum: number, e: any) => sum + ((e.event_data as any)?.value || 0),
        0
      )
    const prevRevenue = allEvents
      .filter(
        (e: any) =>
          new Date(e.created_at) >= prevPeriodStart &&
          new Date(e.created_at) < periodStart
      )
      .reduce(
        (sum: number, e: any) => sum + ((e.event_data as any)?.value || 0),
        0
      )

    // CPA (placeholder — requires ad spend data integration)
    const currentCPA = currentConversions > 0 ? 0 : 0
    const prevCPA = prevConversions > 0 ? 0 : 0

    res.json({
      period,
      days,
      visitors: {
        current: currentVisitors,
        previous: prevVisitors,
        change: prevVisitors
          ? ((currentVisitors - prevVisitors) / prevVisitors) * 100
          : 0,
      },
      conversion_rate: {
        current: Math.round(currentConvRate * 100) / 100,
        previous: Math.round(prevConvRate * 100) / 100,
        change: prevConvRate
          ? Math.round((currentConvRate - prevConvRate) * 100) / 100
          : 0,
      },
      revenue: {
        current: currentRevenue,
        previous: prevRevenue,
        change: prevRevenue
          ? ((currentRevenue - prevRevenue) / prevRevenue) * 100
          : 0,
      },
      cpa: {
        current: currentCPA,
        previous: prevCPA,
        change: 0,
      },
      orders: {
        current: currentConversions,
        previous: prevConversions,
        change: prevConversions
          ? ((currentConversions - prevConversions) / prevConversions) * 100
          : 0,
      },
    })
  } catch (error: any) {
    console.error("[Analytics Admin] Overview error:", error)
    res.status(500).json({ error: error.message })
  }
}
