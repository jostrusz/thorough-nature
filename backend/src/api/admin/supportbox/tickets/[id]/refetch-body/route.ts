// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import axios from "axios"
import { SUPPORTBOX_MODULE } from "../../../../../../modules/supportbox"

/**
 * Re-fetch missing email body from Resend for any inbound message(s) in a ticket
 * where the original webhook-time API call failed (e.g. Resend API returned 404
 * because the email was not yet indexed).
 *
 * POST /admin/supportbox/tickets/:id/refetch-body
 *   body: { message_id?: string }  // optional; if omitted, refetches all failed messages on the ticket
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { id: ticketId } = req.params
  const { message_id } = (req.body as any) || {}

  try {
    const ticket = await supportboxService.retrieveSupportboxTicket(ticketId)
    if (!ticket) {
      return res.status(404).json({ error: "Ticket not found" })
    }

    const config = await supportboxService.retrieveSupportboxConfig(ticket.config_id)
    if (!config?.resend_api_key) {
      return res.status(400).json({ error: "No Resend API key configured" })
    }

    // Load messages for this ticket
    const allMessages = await supportboxService.listSupportboxMessages(
      { ticket_id: ticketId },
      { order: { created_at: "ASC" } }
    )

    // Filter to messages that need refetching
    const targets = allMessages.filter((m: any) => {
      if (m.direction !== "inbound") return false
      if (message_id && m.id !== message_id) return false
      const needsFetch =
        m.metadata?.body_fetch_failed === true ||
        (!m.body_html && !m.body_text) ||
        m.body_text === "(email body could not be loaded)" ||
        m.body_text === "(email body could not be loaded — will retry)"
      return needsFetch && m.metadata?.resend_email_id
    })

    if (targets.length === 0) {
      return res.json({ refetched: 0, message: "No messages need refetching" })
    }

    let refetched = 0
    const errors: { message_id: string; error: string }[] = []

    for (const msg of targets) {
      const emailId = msg.metadata.resend_email_id
      try {
        const emailResponse = await axios.get(
          `https://api.resend.com/emails/receiving/${emailId}`,
          { headers: { Authorization: `Bearer ${config.resend_api_key}` } }
        )
        const emailData = emailResponse.data
        const emailHtml = emailData.html || ""
        const emailText = emailData.text || ""

        // Extract from_name if missing
        let fromName = msg.from_name
        if (!fromName && emailData.from) {
          const nameMatch = emailData.from.match(/^(.+?)\s*</)
          if (nameMatch) fromName = nameMatch[1].trim()
        }

        // Fetch attachments if present
        let attachments: any[] = msg.metadata?.attachments || []
        if (emailData.attachments && emailData.attachments.length > 0 && attachments.length === 0) {
          try {
            const attResponse = await axios.get(
              `https://api.resend.com/emails/receiving/${emailId}/attachments`,
              { headers: { Authorization: `Bearer ${config.resend_api_key}` } }
            )
            const attList = attResponse.data?.data || []
            for (const att of attList) {
              if (att.download_url) {
                try {
                  const dlResponse = await axios.get(att.download_url, {
                    responseType: "arraybuffer",
                  })
                  const base64 = Buffer.from(dlResponse.data).toString("base64")
                  attachments.push({
                    filename: att.filename || "attachment",
                    size: att.size || dlResponse.data.byteLength,
                    content_type: att.content_type || "application/octet-stream",
                    content: base64,
                  })
                } catch (dlErr: any) {
                  attachments.push({
                    filename: att.filename || "attachment",
                    size: att.size || 0,
                    content_type: att.content_type || "application/octet-stream",
                  })
                }
              }
            }
          } catch {
            // best-effort for attachments
          }
        }

        const newMetadata = {
          ...(msg.metadata || {}),
          ...(attachments.length > 0 ? { attachments } : {}),
        }
        delete newMetadata.body_fetch_failed
        delete newMetadata.body_fetch_failed_at
        newMetadata.body_refetched_at = new Date().toISOString()

        await supportboxService.updateSupportboxMessages({
          id: msg.id,
          body_html: emailHtml,
          body_text: emailText,
          from_name: fromName,
          metadata: newMetadata,
        })

        refetched++
      } catch (err: any) {
        errors.push({
          message_id: msg.id,
          error: err?.response?.status
            ? `HTTP ${err.response.status}: ${err.message}`
            : err.message,
        })
      }
    }

    res.json({ refetched, total: targets.length, errors })
  } catch (error: any) {
    console.error(`[SupportBox refetch-body] Error:`, error.message)
    res.status(500).json({ error: error.message })
  }
}
