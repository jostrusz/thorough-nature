import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * GET /admin/analytics/conversion-paths?project_id=xxx&period=7d
 *
 * Returns the most common source sequences leading to conversion.
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

    const filter: Record<string, any> = {}
    if (projectId) filter.project_id = projectId

    // Get all customer journeys
    const journeys = await service.listCustomerJourneys(filter, {
      take: 10000,
    })

    const currentJourneys = journeys.filter(
      (j: any) => new Date(j.created_at) >= periodStart
    )

    // Build path strings from touchpoints
    const pathCounts: Record<string, number> = {}

    for (const j of currentJourneys) {
      const journey = j as any
      const touchpoints = journey.touchpoints || []
      if (touchpoints.length === 0) continue

      const path = touchpoints
        .map((tp: any) => tp.source || "direct")
        .join(" → ")

      pathCounts[path] = (pathCounts[path] || 0) + 1
    }

    const paths = Object.entries(pathCounts)
      .map(([path, count]) => ({
        path,
        steps: path.split(" → "),
        conversions: count,
        percentage:
          currentJourneys.length > 0
            ? Math.round((count / currentJourneys.length) * 10000) / 100
            : 0,
      }))
      .sort((a, b) => b.conversions - a.conversions)
      .slice(0, 20)

    res.json({ paths, total_journeys: currentJourneys.length, period, days })
  } catch (error: any) {
    console.error("[Analytics Admin] Conversion paths error:", error)
    res.status(500).json({ error: error.message })
  }
}
