import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * GET /admin/analytics/email-campaigns?project_id=xxx
 *
 * Lists all EmailCampaigns with their counts.
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

    const filter: Record<string, any> = {}
    if (projectId) filter.project_id = projectId

    const campaigns = await service.listEmailCampaigns(filter, {
      take: 1000,
      order: { created_at: "DESC" } as any,
    })

    // Calculate rates
    const enriched = campaigns.map((c: any) => ({
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
          ? Math.round(((c.opened_count || 0) / c.delivered_count) * 10000) /
            100
          : 0,
      click_rate:
        c.delivered_count > 0
          ? Math.round(((c.clicked_count || 0) / c.delivered_count) * 10000) /
            100
          : 0,
      bounce_rate:
        c.sent_count > 0
          ? Math.round(((c.bounced_count || 0) / c.sent_count) * 10000) / 100
          : 0,
      created_at: c.created_at,
    }))

    res.json({ campaigns: enriched })
  } catch (error: any) {
    console.error("[Analytics Admin] Email campaigns error:", error)
    res.status(500).json({ error: error.message })
  }
}
