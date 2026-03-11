// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../modules/supportbox"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import axios from "axios"

/**
 * Resend Inbound Webhook Handler
 *
 * Resend sends an "email.received" event with metadata only (no body).
 * We must call the Resend Received Emails API to fetch the full email content.
 *
 * Webhook payload format:
 * {
 *   "type": "email.received",
 *   "created_at": "...",
 *   "data": {
 *     "email_id": "uuid",
 *     "from": "sender@example.com",
 *     "to": ["support@domain.com"],
 *     "subject": "Hello",
 *     "created_at": "..."
 *   }
 * }
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const body = req.body as any

  try {
    // ── Parse Resend webhook payload ──
    const eventType = body.type
    const eventData = body.data

    // Only handle email.received events
    if (eventType !== "email.received") {
      return res.status(200).json({ ok: true, skipped: eventType })
    }

    const emailId = eventData?.email_id
    const toAddresses = eventData?.to || []
    const fromAddress = eventData?.from || ""
    const subject = eventData?.subject || "(no subject)"

    if (!emailId || toAddresses.length === 0) {
      return res.status(400).json({ error: "Missing email_id or to address" })
    }

    // ── Find config by recipient email address ──
    let config = null
    let toAddress = ""
    for (const addr of toAddresses) {
      const cleaned = addr.replace(/<|>/g, "").trim().toLowerCase()
      const configs = await supportboxService.listSupportboxConfigs({
        email_address: cleaned,
      })
      if (configs.length > 0) {
        config = configs[0]
        toAddress = cleaned
        break
      }
    }

    if (!config) {
      // Try matching just the email part (strip "Name <email>" format)
      for (const addr of toAddresses) {
        const match = addr.match(/[\w.-]+@[\w.-]+/)
        if (match) {
          const email = match[0].toLowerCase()
          const configs = await supportboxService.listSupportboxConfigs({
            email_address: email,
          })
          if (configs.length > 0) {
            config = configs[0]
            toAddress = email
            break
          }
        }
      }
    }

    if (!config) {
      console.log(`[SupportBox] No config found for to: ${JSON.stringify(toAddresses)}`)
      return res.status(400).json({ error: "Config not found for email address" })
    }

    // ── Fetch full email content from Resend API ──
    let emailHtml = ""
    let emailText = ""
    let fromName = ""

    if (config.resend_api_key) {
      try {
        const emailResponse = await axios.get(
          `https://api.resend.com/emails/receiving/${emailId}`,
          {
            headers: {
              Authorization: `Bearer ${config.resend_api_key}`,
            },
          }
        )
        const emailData = emailResponse.data
        emailHtml = emailData.html || ""
        emailText = emailData.text || ""
        // Try to extract name from "Name <email>" format in from
        const nameMatch = (emailData.from || fromAddress).match(/^(.+?)\s*</)
        fromName = nameMatch ? nameMatch[1].trim() : ""
      } catch (fetchError: any) {
        console.log(`[SupportBox] Failed to fetch email content: ${fetchError.message}`)
        // Continue without body — at least create the ticket
        emailText = "(email body could not be loaded)"
      }
    }

    // Clean from address (strip "Name <email>" format)
    const cleanFrom = (fromAddress.match(/[\w.-]+@[\w.-]+/) || [fromAddress])[0]?.toLowerCase() || fromAddress

    // ── Find or create ticket ──
    const cleanSubject = subject.replace(/^(re|fw|fwd):\s*/gi, "").trim()
    const threadKey = `${cleanFrom}|${cleanSubject.toLowerCase()}`

    const existingTickets = await supportboxService.listSupportboxTickets({
      thread_key: threadKey,
      config_id: config.id,
    })

    let ticket
    if (existingTickets.length > 0) {
      ticket = existingTickets[0]
      // Reopen if it was solved/old
      if (ticket.status === "solved" || ticket.status === "old") {
        await supportboxService.updateSupportboxTickets({
          id: ticket.id,
          status: "new",
          solved_at: null,
        })
      }
    } else {
      ticket = await supportboxService.createSupportboxTickets({
        config_id: config.id,
        from_email: cleanFrom,
        from_name: fromName,
        subject,
        thread_key: threadKey,
        status: "new",
      })

      // Auto-match order by customer email
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["id", "customer_id"],
          filters: { email: cleanFrom },
          pagination: { take: 1, order: { created_at: "DESC" } },
        })
        if (orders && orders.length > 0) {
          await supportboxService.updateSupportboxTickets({
            id: ticket.id,
            order_id: orders[0].id,
            customer_id: orders[0].customer_id,
          })
        }
      } catch (e) {
        // Order matching is best-effort
      }
    }

    // ── Create inbound message ──
    const message = await supportboxService.createSupportboxMessages({
      ticket_id: ticket.id,
      direction: "inbound",
      from_email: cleanFrom,
      from_name: fromName,
      body_html: emailHtml,
      body_text: emailText,
      metadata: { resend_email_id: emailId },
    })

    console.log(`[SupportBox] Inbound email processed: ticket=${ticket.id}, from=${cleanFrom}, subject=${subject}`)
    res.status(200).json({ ticket, message })
  } catch (error: any) {
    console.error(`[SupportBox] Webhook error:`, error.message)
    res.status(500).json({ error: error.message })
  }
}
