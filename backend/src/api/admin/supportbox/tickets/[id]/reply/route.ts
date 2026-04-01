// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../../modules/supportbox"
import axios from "axios"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id } = req.params
  const body = req.body as any

  try {
    // Get ticket and messages separately (models don't define ORM relations)
    const ticket = await supportboxService.retrieveSupportboxTicket(id)
    ticket.messages = await supportboxService.listSupportboxMessages(
      { ticket_id: id },
      { order: { created_at: "ASC" } }
    )

    // Get config for API key
    const config = await supportboxService.retrieveSupportboxConfig(ticket.config_id)

    if (!config.resend_api_key) {
      return res.status(400).json({ error: "Resend API key not configured" })
    }

    // Build email with full conversation history
    const messages = ticket.messages || []
    const conversationHistory = messages
      .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .map((msg: any) => {
        const date = new Date(msg.created_at).toLocaleString("cs-CZ")
        const sender = msg.direction === "inbound"
          ? `${msg.from_name || msg.from_email}`
          : `${config.display_name || config.email_address}`
        return `<div style="margin-bottom:12px;padding:8px 12px;border-left:3px solid ${msg.direction === "inbound" ? "#E1E3E5" : "#008060"};background:${msg.direction === "inbound" ? "#F9FAFB" : "#F0FDF4"};">
          <div style="font-size:11px;color:#6D7175;margin-bottom:4px;">${sender} — ${date}</div>
          <div>${msg.body_html || msg.body_text || ""}</div>
        </div>`
      })
      .join("")

    // Normalize contenteditable HTML for email clients:
    // Chrome wraps lines in <div>, Firefox uses <br>. Convert to <p> with spacing.
    let replyHtml = (body.body_html || "").trim()
    // Replace <div><br></div> (empty line from Chrome) with paragraph break
    replyHtml = replyHtml.replace(/<div><br\s*\/?><\/div>/gi, '</p><p style="margin:0 0 12px 0;">&nbsp;</p><p style="margin:0 0 12px 0;">')
    // Wrap remaining <div>...</div> blocks as paragraphs
    replyHtml = replyHtml.replace(/<div>(.*?)<\/div>/gi, '<p style="margin:0 0 12px 0;">$1</p>')
    // Convert double <br> to paragraph break
    replyHtml = replyHtml.replace(/(<br\s*\/?>){2,}/gi, '</p><p style="margin:0 0 12px 0;">')
    // Wrap in opening <p> if not already wrapped
    if (!replyHtml.startsWith('<p')) {
      replyHtml = `<p style="margin:0 0 12px 0;">${replyHtml}</p>`
    }

    const fullEmailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#1a1a1a;">
        ${replyHtml}
      </div>
      <br/>
      <div style="border-top:1px solid #E1E3E5;padding-top:12px;margin-top:16px;">
        <div style="font-size:11px;color:#8C9196;margin-bottom:8px;">— Previous conversation —</div>
        ${conversationHistory}
      </div>
    `

    // Send via Resend API — use sender_name for friendly "from" display
    const fromField = config.sender_name
      ? `${config.sender_name} <${config.email_address}>`
      : config.email_address

    // Build Resend payload
    const resendPayload: any = {
      from: fromField,
      to: ticket.from_email,
      subject: `Re: ${ticket.subject}`,
      html: fullEmailHtml,
      reply_to: config.email_address,
    }

    // Process attachments: array of { filename, content (base64), content_type }
    const attachmentMeta: { filename: string; size: number; content_type: string }[] = []
    if (body.attachments && Array.isArray(body.attachments) && body.attachments.length > 0) {
      resendPayload.attachments = body.attachments.map((att: any) => {
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

    // Create outbound message with attachment metadata
    const messageMeta: any = {}
    if (attachmentMeta.length > 0) {
      messageMeta.attachments = attachmentMeta
    }

    const message = await supportboxService.createSupportboxMessages({
      ticket_id: id,
      direction: "outbound",
      from_email: config.email_address,
      from_name: config.display_name,
      body_html: body.body_html,
      body_text: body.body_text,
      resend_message_id: resendResponse.data.id,
      delivery_status: "sent",
      delivery_status_at: new Date().toISOString(),
      metadata: Object.keys(messageMeta).length > 0 ? messageMeta : null,
    })

    // Auto-solve ticket after admin reply (unless keep_open is set)
    if (!body.keep_open) {
      await supportboxService.updateSupportboxTickets({
        id,
        status: "solved",
        solved_at: new Date().toISOString(),
      })
    }

    res.json({ message, kept_open: !!body.keep_open })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
