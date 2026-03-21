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

    const fullEmailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
        ${body.body_html}
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

    const resendResponse = await axios.post(
      "https://api.resend.com/emails",
      {
        from: fromField,
        to: ticket.from_email,
        subject: `Re: ${ticket.subject}`,
        html: fullEmailHtml,
        reply_to: config.email_address,
      },
      {
        headers: {
          Authorization: `Bearer ${config.resend_api_key}`,
          "Content-Type": "application/json",
        },
      }
    )

    // Create outbound message (store only the new reply)
    const message = await supportboxService.createSupportboxMessages({
      ticket_id: id,
      direction: "outbound",
      from_email: config.email_address,
      from_name: config.display_name,
      body_html: body.body_html,
      body_text: body.body_text,
      resend_message_id: resendResponse.data.id,
    })

    // Auto-solve ticket after admin reply
    await supportboxService.updateSupportboxTickets({
      id,
      status: "solved",
      solved_at: new Date().toISOString(),
    })

    res.json({ message })
  } catch (error: any) {
    res.status(400).json({ error: error.message })
  }
}
