// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../modules/supportbox"
import axios from "axios"

/**
 * POST /admin/supportbox/tickets/compose
 *
 * Create a new outbound email (new ticket initiated by admin).
 * Body: { config_id, to_email, to_name?, subject, body_html, body_text? }
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
    // Get config for API key and sender info
    const config = await supportboxService.retrieveSupportboxConfig(config_id)

    if (!config.resend_api_key) {
      return res.status(400).json({ error: "Resend API key not configured for this account" })
    }

    // Build thread_key for future replies
    const cleanSubject = subject.replace(/^(re:|fw:|fwd:)\s*/gi, "").toLowerCase().trim()
    const threadKey = `${to_email.toLowerCase()}|${cleanSubject}`

    // Check if a ticket already exists for this thread
    const existingTickets = await supportboxService.listSupportboxTickets({
      thread_key: threadKey,
      config_id: config_id,
    })

    let ticket: any

    if (existingTickets.length > 0) {
      // Reuse existing ticket
      ticket = existingTickets[0]
      // Reopen if solved/old
      if (ticket.status === "solved" || ticket.status === "old") {
        await supportboxService.updateSupportboxTickets({
          id: ticket.id,
          status: "new",
        })
      }
    } else {
      // Create a new ticket
      ticket = await supportboxService.createSupportboxTickets({
        config_id,
        from_email: to_email,
        from_name: to_name || null,
        subject,
        status: "new",
        thread_key: threadKey,
      })
    }

    // Build the email HTML
    const fullEmailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ${body_html}
      </div>
    `

    // Send via Resend API — use sender_name for friendly "from" display
    const fromField = config.sender_name
      ? `${config.sender_name} <${config.email_address}>`
      : config.email_address

    // Build Resend payload
    const resendPayload: any = {
      from: fromField,
      to: to_email,
      subject: subject,
      html: fullEmailHtml,
      reply_to: config.email_address,
    }

    // Process attachments: array of { filename, content (base64), content_type }
    const attachmentMeta: { filename: string; size: number; content_type: string }[] = []
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      resendPayload.attachments = attachments.map((att: any) => {
        attachmentMeta.push({
          filename: att.filename,
          size: att.size || 0,
          content_type: att.content_type || "application/octet-stream",
        })
        return {
          filename: att.filename,
          content: att.content, // base64 string
          content_type: att.content_type || "application/octet-stream",
        }
      })
    }

    const resendResponse = await axios.post(
      "https://api.resend.com/emails",
      resendPayload,
      {
        headers: {
          Authorization: `Bearer ${config.resend_api_key}`,
          "Content-Type": "application/json",
        },
      }
    )

    // Store outbound message with attachment metadata
    const messageMeta: any = {}
    if (attachmentMeta.length > 0) {
      messageMeta.attachments = attachmentMeta
    }

    const message = await supportboxService.createSupportboxMessages({
      ticket_id: ticket.id,
      direction: "outbound",
      from_email: config.email_address,
      from_name: config.display_name,
      body_html,
      body_text: body_text || null,
      resend_message_id: resendResponse.data.id,
      delivery_status: "sent",
      delivery_status_at: new Date().toISOString(),
      metadata: Object.keys(messageMeta).length > 0 ? messageMeta : null,
    })

    // Auto-solve after composing — admin initiated, no reply expected yet
    await supportboxService.updateSupportboxTickets({
      id: ticket.id,
      status: "solved",
      solved_at: new Date().toISOString(),
    })

    // Return updated ticket with solved status
    const updatedTicket = await supportboxService.retrieveSupportboxTicket(ticket.id)
    res.json({ ticket: updatedTicket, message })
  } catch (error: any) {
    console.error("[Supportbox Compose] Error:", error.response?.data || error.message)
    res.status(400).json({ error: error.response?.data?.message || error.message })
  }
}
