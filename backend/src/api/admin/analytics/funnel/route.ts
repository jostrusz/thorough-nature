import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * GET /admin/analytics/funnel?project_id=xxx&period=7d
 *
 * Returns funnel steps: page_view → view_content → add_to_cart →
 * initiate_checkout → add_payment_info → purchase
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

    // Count unique visitors for page views
    const pageViews = await service.listPageViews(baseFilter, { take: 10000 })
    const currentPageViews = pageViews.filter(
      (pv: any) => new Date(pv.created_at) >= periodStart
    )
    const pageViewVisitors = new Set(
      currentPageViews.map((pv: any) => pv.visitor_id)
    ).size

    // Count unique visitors per event type
    const allEvents = await service.listConversionEvents(baseFilter, {
      take: 10000,
    })
    const currentEvents = allEvents.filter(
      (e: any) => new Date(e.created_at) >= periodStart
    )

    const funnelSteps = [
      "view_content",
      "add_to_cart",
      "initiate_checkout",
      "add_payment_info",
      "purchase",
    ]

    const eventCounts: Record<string, number> = {}
    for (const step of funnelSteps) {
      const visitors = new Set(
        currentEvents
          .filter((e: any) => e.event_type === step)
          .map((e: any) => e.visitor_id)
      )
      eventCounts[step] = visitors.size
    }

    const funnel = [
      {
        step: "page_view",
        label: "Visitors",
        count: pageViewVisitors,
        rate: 100,
      },
      ...funnelSteps.map((step, i) => {
        const count = eventCounts[step] || 0
        const prevCount =
          i === 0 ? pageViewVisitors : eventCounts[funnelSteps[i - 1]] || 0
        return {
          step,
          label:
            step === "view_content"
              ? "View Content"
              : step === "add_to_cart"
                ? "Add to Cart"
                : step === "initiate_checkout"
                  ? "Initiate Checkout"
                  : step === "add_payment_info"
                    ? "Add Payment Info"
                    : "Purchase",
          count,
          rate:
            pageViewVisitors > 0
              ? Math.round((count / pageViewVisitors) * 10000) / 100
              : 0,
          drop_off:
            prevCount > 0
              ? Math.round(((prevCount - count) / prevCount) * 10000) / 100
              : 0,
        }
      }),
    ]

    res.json({ funnel, period, days })
  } catch (error: any) {
    console.error("[Analytics Admin] Funnel error:", error)
    res.status(500).json({ error: error.message })
  }
}
