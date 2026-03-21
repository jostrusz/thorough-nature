// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../modules/supportbox"

/**
 * Resend Delivery Webhook Handler
 *
 * Handles email delivery status events from Resend:
 * - email.sent        → email accepted by Resend
 * - email.delivered    → delivered to recipient's mail server
 * - email.delivery_delayed → temporary delivery failure
 * - email.bounced      → permanent delivery failure
 * - email.complained   → recipient marked as spam
 * - email.opened       → recipient opened the email
 * - email.clicked      → recipient clicked a link
 *
 * Webhook payload format:
 * {
 *   "type": "email.delivered",
 *   "created_at": "...",
 *   "data": {
 *     "email_id": "uuid",        // Resend message ID
 *     "from": "sender@domain",
 *     "to": ["recipient@domain"],
 *     "subject": "...",
 *     "created_at": "..."
 *   }
 * }
 */

const DELIVERY_EVENTS = [
  "email.sent",
  "email.delivered",
  "email.delivery_delayed",
  "email.bounced",
  "email.complained",
  "email.opened",
  "email.clicked",
]

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const body = req.body as any

  try {
    const eventType = body.type
    const eventData = body.data

    // Only handle delivery events
    if (!DELIVERY_EVENTS.includes(eventType)) {
      return res.status(200).json({ ok: true, skipped: eventType })
    }

    const emailId = eventData?.email_id
    if (!emailId) {
      return res.status(400).json({ error: "Missing email_id" })
    }

    // Extract status name from event type (e.g. "email.delivered" → "delivered")
    const status = eventType.replace("email.", "")
    const timestamp = eventData?.created_at || body.created_at || new Date().toISOString()

    // Find message by resend_message_id
    const messages = await supportboxService.listSupportboxMessages({
      resend_message_id: emailId,
    })

    if (messages.length === 0) {
      // Not a SupportBox message — might be from email-notifications or other module
      return res.status(200).json({ ok: true, skipped: "no matching message" })
    }

    const message = messages[0]

    // Update delivery status
    await supportboxService.updateSupportboxMessages({
      id: message.id,
      delivery_status: status,
      delivery_status_at: timestamp,
    })

    console.log(`[SupportBox] Delivery status updated: message=${message.id}, status=${status}`)
    res.status(200).json({ ok: true, status })
  } catch (error: any) {
    console.error(`[SupportBox] Delivery webhook error:`, error.message)
    // Return 200 to prevent Resend from retrying
    res.status(200).json({ ok: false, error: error.message })
  }
}
