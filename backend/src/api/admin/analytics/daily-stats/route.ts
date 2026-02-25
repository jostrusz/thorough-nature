import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * GET /admin/analytics/daily-stats?project_id=xxx&period=7d
 *
 * Returns daily visitors and conversions by channel.
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

    // Group by date + source
    const dailyMap: Record<
      string,
      Record<string, { visitors: Set<string>; conversions: number }>
    > = {}

    // Initialize all days
    for (let i = 0; i < days; i++) {
      const d = new Date(periodStart.getTime() + i * 24 * 60 * 60 * 1000)
      const dateKey = d.toISOString().split("T")[0]
      dailyMap[dateKey] = {}
    }

    for (const s of currentSessions) {
      const sess = s as any
      const dateKey = new Date(sess.created_at).toISOString().split("T")[0]
      const source = sess.traffic_source || "direct"

      if (!dailyMap[dateKey]) dailyMap[dateKey] = {}
      if (!dailyMap[dateKey][source]) {
        dailyMap[dateKey][source] = { visitors: new Set(), conversions: 0 }
      }

      dailyMap[dateKey][source].visitors.add(sess.visitor_id)
      if (sess.has_conversion) {
        dailyMap[dateKey][source].conversions++
      }
    }

    // Collect all unique sources
    const allSources = new Set<string>()
    for (const dateData of Object.values(dailyMap)) {
      for (const source of Object.keys(dateData)) {
        allSources.add(source)
      }
    }

    const daily = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, sources]) => {
        const bySource: Record<
          string,
          { visitors: number; conversions: number }
        > = {}
        let totalVisitors = 0
        let totalConversions = 0

        for (const [source, data] of Object.entries(sources)) {
          bySource[source] = {
            visitors: data.visitors.size,
            conversions: data.conversions,
          }
          totalVisitors += data.visitors.size
          totalConversions += data.conversions
        }

        return {
          date,
          total_visitors: totalVisitors,
          total_conversions: totalConversions,
          by_source: bySource,
        }
      })

    res.json({
      daily,
      sources: Array.from(allSources).sort(),
      period,
      days,
    })
  } catch (error: any) {
    console.error("[Analytics Admin] Daily stats error:", error)
    res.status(500).json({ error: error.message })
  }
}
