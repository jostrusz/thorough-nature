// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../modules/supportbox"
import { composeNewEmail } from "../../../../../modules/supportbox/utils/compose-new-email"

/**
 * POST /admin/supportbox/tickets/compose
 *
 * Create a new outbound email (new ticket initiated by admin).
 * Body: { config_id, to_email, to_name?, subject, body_html, body_text? }
 *
 * Send logic lives in modules/supportbox/utils/compose-new-email.ts — shared
 * with the MCP webhook route (/webhooks/supportbox-mcp, action "compose").
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const body = req.body as any

  const { config_id, to_email, to_name, subject, body_html, body_text, attachments } = body

  if (!config_id || !to_email || !subject || !body_html) {
    return res.status(400).json({
      error: "Missing required fields: config_id, to_email, subject, body_html",
    })
  }

  try {
    const { ticket, message } = await composeNewEmail(supportboxService, {
      config_id,
      to_email,
      to_name,
      subject,
      body_html,
      body_text,
      attachments,
    })
    res.json({ ticket, message })
  } catch (error: any) {
    console.error("[Supportbox Compose] Error:", error.response?.data || error.message)
    res.status(400).json({ error: error.response?.data?.message || error.message })
  }
}
