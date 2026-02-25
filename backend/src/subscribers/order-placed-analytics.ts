import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { ANALYTICS_MODULE } from "../modules/analytics"
import type AnalyticsModuleService from "../modules/analytics/service"

/**
 * Subscriber: order.placed → Analytics Attribution
 *
 * 1. Finalizes the VisitorSession (has_conversion, order_id)
 * 2. Builds a CustomerJourney with touchpoint + attribution data
 * 3. If email-sourced → creates EmailConversion + updates EmailCampaign
 */
export default async function orderPlacedAnalyticsHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const orderService: IOrderModuleService = container.resolve(Modules.ORDER)
    const analyticsService = container.resolve(
      ANALYTICS_MODULE
    ) as unknown as AnalyticsModuleService

    // ── Retrieve order ──
    const order = await orderService.retrieveOrder(data.id, {
      relations: ["items", "summary"],
    })

    if (!order) {
      console.warn("[Analytics Subscriber] Order not found:", data.id)
      return
    }

    const metadata = (order.metadata || {}) as Record<string, any>
    const visitorId = metadata.analytics_visitor_id
    const sessionId = metadata.analytics_session_id
    const projectId = metadata.project_id || "default"

    if (!visitorId || !sessionId) {
      console.log(
        "[Analytics Subscriber] No analytics IDs on order, skipping:",
        data.id
      )
      return
    }

    // ── 1. Finalize VisitorSession ──
    const sessions = await analyticsService.listVisitorSessions({
      session_id: sessionId,
    })

    if (sessions.length > 0) {
      const session = sessions[0] as any
      await analyticsService.updateVisitorSessions({
        id: session.id,
        has_conversion: true,
        conversion_type: "purchase",
        order_id: order.id,
      })
    }

    // ── 2. Create ConversionEvent for purchase ──
    const totalValue =
      (order.summary as any)?.current_order_total ||
      (order.summary as any)?.total ||
      0

    await analyticsService.createConversionEvents({
      project_id: projectId,
      session_id: sessionId,
      visitor_id: visitorId,
      event_type: "purchase",
      event_data: {
        order_id: order.id,
        value: totalValue,
        currency: order.currency_code,
      },
      page_url: null,
    })

    // ── 3. Build CustomerJourney ──
    // Gather all sessions for this visitor
    const allSessions = await analyticsService.listVisitorSessions(
      { visitor_id: visitorId, project_id: projectId },
      { order: { created_at: "ASC" } as any }
    )

    // Gather all page views for this visitor
    const allPageViews = await analyticsService.listPageViews(
      { visitor_id: visitorId, project_id: projectId },
      { order: { created_at: "ASC" } as any }
    )

    // Build touchpoints array
    const touchpoints: any[] = []
    for (const s of allSessions) {
      const sess = s as any
      touchpoints.push({
        type: "session",
        session_id: sess.session_id,
        source: sess.traffic_source || "direct",
        medium: sess.traffic_medium || "none",
        utm_campaign: sess.utm_campaign || null,
        first_page: sess.first_page_url,
        pages_viewed: sess.pages_viewed || 1,
        duration: sess.duration_seconds || 0,
        timestamp: sess.created_at,
      })
    }

    // First and last touch attribution
    const firstSession = allSessions.length > 0 ? (allSessions[0] as any) : null
    const lastSession =
      allSessions.length > 0
        ? (allSessions[allSessions.length - 1] as any)
        : null

    // Days to conversion
    let daysToConversion = 0
    if (firstSession && firstSession.created_at) {
      const firstDate = new Date(firstSession.created_at)
      const now = new Date()
      daysToConversion = Math.round(
        (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
      )
    }

    await analyticsService.createCustomerJourneys({
      project_id: projectId,
      visitor_id: visitorId,
      order_id: order.id,
      touchpoints: { items: touchpoints } as any,
      first_touch_source: firstSession?.traffic_source || "direct",
      first_touch_medium: firstSession?.traffic_medium || "none",
      last_touch_source: lastSession?.traffic_source || "direct",
      last_touch_medium: lastSession?.traffic_medium || "none",
      total_touchpoints: touchpoints.length,
      total_sessions: allSessions.length,
      days_to_conversion: daysToConversion,
    })

    // ── 4. Email attribution ──
    // If the last session came from email, create EmailConversion
    if (lastSession?.traffic_source === "email") {
      const utmCampaign = lastSession.utm_campaign || "Unknown"

      // Find matching EmailCampaign
      const campaigns = await analyticsService.listEmailCampaigns({
        project_id: projectId,
        email_name: utmCampaign,
      })

      if (campaigns.length > 0) {
        const campaign = campaigns[0] as any

        // Create EmailConversion
        await analyticsService.createEmailConversions({
          email_campaign_id: campaign.id,
          customer_email: order.email || "",
          order_id: order.id,
          order_amount: totalValue,
          clicked_link: lastSession.first_page_url || null,
          time_to_conversion: lastSession.duration_seconds || 0,
        })

        // Update EmailCampaign counters
        await analyticsService.updateEmailCampaigns({
          id: campaign.id,
          conversion_count: (campaign.conversion_count || 0) + 1,
          revenue: (campaign.revenue || 0) + totalValue,
        })
      }
    }

    console.log(
      `[Analytics Subscriber] Attribution created for order ${order.id}`,
      `| visitor: ${visitorId.slice(0, 8)}...`,
      `| sessions: ${allSessions.length}`,
      `| first: ${firstSession?.traffic_source || "?"}`,
      `| last: ${lastSession?.traffic_source || "?"}`
    )
  } catch (error: any) {
    // Never let tracking errors crash the order flow
    console.error("[Analytics Subscriber] Error:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
