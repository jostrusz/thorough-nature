import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ANALYTICS_MODULE } from "../../../../modules/analytics"
import type AnalyticsModuleService from "../../../../modules/analytics/service"

/**
 * POST /store/analytics/email-webhook
 *
 * Handles Resend webhook events (email.sent, email.delivered, email.opened,
 * email.clicked, email.bounced, email.complained).
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const body = req.body as Record<string, any>
    const { type, data } = body

    if (!type || !data) {
      res.status(400).json({ error: "Invalid webhook payload" })
      return
    }

    const service = req.scope.resolve(
      ANALYTICS_MODULE
    ) as unknown as AnalyticsModuleService

    // Extract campaign identifier from email subject or tags
    const emailName = data.subject || data.tags?.[0] || "Unknown"
    const projectId =
      data.tags
        ?.find((t: string) => t.startsWith("project:"))
        ?.replace("project:", "") || "default"

    // Find or create EmailCampaign by name + project
    let campaigns = await service.listEmailCampaigns({
      email_name: emailName,
      project_id: projectId,
    })

    let campaign: any
    if (campaigns.length === 0) {
      campaign = await service.createEmailCampaigns({
        project_id: projectId,
        email_name: emailName,
        email_subject: data.subject || null,
        email_type:
          data.tags
            ?.find((t: string) => t.startsWith("type:"))
            ?.replace("type:", "") || null,
      })
    } else {
      campaign = campaigns[0]
    }

    // Increment appropriate counter based on event type
    const updateData: Record<string, any> = { id: campaign.id }

    switch (type) {
      case "email.sent":
        updateData.sent_count = (campaign.sent_count || 0) + 1
        break
      case "email.delivered":
        updateData.delivered_count = (campaign.delivered_count || 0) + 1
        break
      case "email.opened":
        updateData.opened_count = (campaign.opened_count || 0) + 1
        break
      case "email.clicked":
        updateData.clicked_count = (campaign.clicked_count || 0) + 1
        break
      case "email.bounced":
        updateData.bounced_count = (campaign.bounced_count || 0) + 1
        break
      case "email.complained":
        updateData.unsubscribed_count =
          (campaign.unsubscribed_count || 0) + 1
        break
      default:
        // Unknown event type — skip update
        res.json({ success: true, message: `Unknown event type: ${type}` })
        return
    }

    await service.updateEmailCampaigns(updateData)

    res.json({ success: true })
  } catch (error: any) {
    console.error("[Analytics] Email webhook error:", error)
    res.status(500).json({ error: error.message })
  }
}
