import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * POST /store/analytics/event
 *
 * Creates a ConversionEvent and updates the VisitorSession's conversion status.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const body = req.body as Record<string, any>
    const { project_id, session_id, visitor_id, event_type } = body

    if (!project_id || !session_id || !visitor_id || !event_type) {
      res.status(400).json({
        error: "project_id, session_id, visitor_id, and event_type are required",
      })
      return
    }

    const service = req.scope.resolve(
      ANALYTICS_MODULE
    ) as unknown as AnalyticsModuleService

    // Create ConversionEvent
    await service.createConversionEvents({
      project_id,
      session_id,
      visitor_id,
      event_type,
      event_data: body.event_data || null,
      page_url: body.page_url || null,
    })

    // Update VisitorSession if this is a conversion-type event
    const conversionEvents = [
      "add_to_cart",
      "initiate_checkout",
      "add_payment_info",
      "purchase",
    ]
    if (conversionEvents.includes(event_type)) {
      const sessions = await service.listVisitorSessions({ session_id })
      if (sessions.length > 0) {
        const updateData: Record<string, any> = {
          id: (sessions[0] as any).id,
          has_conversion: true,
          conversion_type: event_type,
        }
        if (event_type === "purchase" && body.event_data?.order_id) {
          updateData.order_id = body.event_data.order_id
        }
        await service.updateVisitorSessions(updateData)
      }
    }

    res.json({ success: true })
  } catch (error: any) {
    console.error("[Analytics] Event error:", error)
    res.status(500).json({ error: error.message })
  }
}
