import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../../../modules/analytics/service"

/**
 * GET /admin/analytics/customer-journey/by-order/:orderId
 *
 * Returns the CustomerJourney for a specific order, with touchpoints and attribution.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const service = req.scope.resolve(
      ANALYTICS_MODULE
    ) as unknown as AnalyticsModuleService

    const orderId = (req.params as any).orderId

    const journeys = await service.listCustomerJourneys({
      order_id: orderId,
    })

    if (journeys.length === 0) {
      res.status(404).json({ error: "No journey found for this order" })
      return
    }

    const journey = journeys[0] as any

    res.json({
      journey: {
        id: journey.id,
        project_id: journey.project_id,
        visitor_id: journey.visitor_id,
        order_id: journey.order_id,
        touchpoints: journey.touchpoints || [],
        first_touch_source: journey.first_touch_source,
        first_touch_medium: journey.first_touch_medium,
        last_touch_source: journey.last_touch_source,
        last_touch_medium: journey.last_touch_medium,
        total_touchpoints: journey.total_touchpoints,
        total_sessions: journey.total_sessions,
        days_to_conversion: journey.days_to_conversion,
        created_at: journey.created_at,
      },
    })
  } catch (error: any) {
    console.error("[Analytics Admin] Customer journey error:", error)
    res.status(500).json({ error: error.message })
  }
}
