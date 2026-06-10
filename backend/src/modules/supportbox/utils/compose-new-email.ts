// @ts-nocheck
import axios from "axios"

/**
 * Shared SupportBox compose logic — single source of truth for sending a NEW
 * outbound e-mail (admin-initiated, not a reply). Used by BOTH the admin route
 * (/admin/supportbox/tickets/compose) and the MCP webhook route
 * (/webhooks/supportbox-mcp). Keep the send behaviour in here so the two
 * callers never drift — mirrors send-ticket-reply.ts.
 *
 * Creates a new ticket (or reuses one matching the thread_key) so an eventual
 * customer reply threads back into the same conversation.
 *
 * @param supportboxService  resolved SUPPORTBOX_MODULE service
 * @param body               { config_id, to_email, to_name?, subject, body_html,
 *                             body_text?, attachments?, keep_open? }
 * @returns { ticket, message }
 */
export async function composeNewEmail(
  supportboxService: any,
  body: {
    config_id: string
    to_email: string
    to_name?: string
    subject: string
    body_html: string
    body_text?: string
    attachments?: { filename: string; content: string; content_type?: string; size?: number }[]
    keep_open?: boolean
  }
) {
  const { config_id, to_email, to_name, subject, body_html, body_text, attachments } = body

  // Get config for API key and sender info
  const config = await supportboxService.retrieveSupportboxConfig(config_id)

  if (!config.resend_api_key) {
    throw new Error("Resend API key not configured for this account")
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

  // Normalize HTML: convert plain \n to <br> for proper formatting
  let normalizedHtml = (body_html || "").trim()
  normalizedHtml = normalizedHtml.replace(/<div><br\s*\/?><\/div>/gi, '</p><p style="margin:0 0 12px 0;">&nbsp;</p><p style="margin:0 0 12px 0;">')
  normalizedHtml = normalizedHtml.replace(/<div>(.*?)<\/div>/gi, '<p style="margin:0 0 12px 0;">$1</p>')
  normalizedHtml = normalizedHtml.replace(/(<br\s*\/?>){2,}/gi, '</p><p style="margin:0 0 12px 0;">')
  normalizedHtml = normalizedHtml.replace(/\n/g, '<br>')
  if (!normalizedHtml.startsWith('<p')) {
    normalizedHtml = `<p style="margin:0 0 12px 0;">${normalizedHtml}</p>`
  }

  // Build the email HTML
  const fullEmailHtml = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;">
      ${normalizedHtml}
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
    body_html: normalizedHtml,
    body_text: body_text || null,
    resend_message_id: resendResponse.data.id,
    delivery_status: "sent",
    delivery_status_at: new Date().toISOString(),
    metadata: Object.keys(messageMeta).length > 0 ? messageMeta : null,
  })

  // Auto-solve after composing — admin initiated, no reply expected yet
  // (unless keep_open is set, e.g. when the sender expects an answer)
  if (!body.keep_open) {
    await supportboxService.updateSupportboxTickets({
      id: ticket.id,
      status: "solved",
      solved_at: new Date().toISOString(),
    })
  }

  // Return updated ticket with final status
  const updatedTicket = await supportboxService.retrieveSupportboxTicket(ticket.id)
  return { ticket: updatedTicket, message }
}
