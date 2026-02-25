import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../../modules/analytics/service"

/**
 * GET /admin/analytics/email-campaigns/:id
 *
 * Returns a single EmailCampaign with its EmailConversions.
 */
export async function GET(
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const service = req.scope.resolve(
      ANALYTICS_MODULE
    ) as unknown as AnalyticsModuleService

    const campaignId = (req.params as any).id

    // Get campaign
    const campaign = await service.retrieveEmailCampaign(campaignId)

    if (!campaign) {
      res.status(404).json({ error: "Campaign not found" })
      return
    }

    const c = campaign as any

    // Get conversions for this campaign
    const conversions = await service.listEmailConversions(
      { email_campaign_id: campaignId },
      { take: 1000, order: { created_at: "DESC" } as any }
    )

    res.json({
      campaign: {
        id: c.id,
        project_id: c.project_id,
        email_name: c.email_name,
        email_subject: c.email_subject,
        email_type: c.email_type,
        sent_count: c.sent_count || 0,
        delivered_count: c.delivered_count || 0,
        opened_count: c.opened_count || 0,
        clicked_count: c.clicked_count || 0,
        bounced_count: c.bounced_count || 0,
        unsubscribed_count: c.unsubscribed_count || 0,
        conversion_count: c.conversion_count || 0,
        revenue: c.revenue || 0,
        open_rate:
          c.delivered_count > 0
            ? Math.round(
                ((c.opened_count || 0) / c.delivered_count) * 10000
              ) / 100
            : 0,
        click_rate:
          c.delivered_count > 0
            ? Math.round(
                ((c.clicked_count || 0) / c.delivered_count) * 10000
              ) / 100
            : 0,
        created_at: c.created_at,
      },
      conversions: conversions.map((conv: any) => ({
        id: conv.id,
        customer_email: conv.customer_email,
        order_id: conv.order_id,
        order_amount: conv.order_amount,
        clicked_link: conv.clicked_link,
        time_to_conversion: conv.time_to_conversion,
        created_at: conv.created_at,
      })),
    })
  } catch (error: any) {
    console.error("[Analytics Admin] Email campaign detail error:", error)
    res.status(500).json({ error: error.message })
  }
}
