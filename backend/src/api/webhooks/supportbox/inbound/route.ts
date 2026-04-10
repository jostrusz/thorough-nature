// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../modules/supportbox"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import axios from "axios"
import { generateAiLabels } from "../ai-label"

function stripHtmlTags(html: string): string {
  return html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim() || ""
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Fetch an inbound email from Resend with retry/backoff.
 * Resend's webhook occasionally fires BEFORE the email is indexed in their API,
 * so the first GET may 404. We retry up to maxAttempts times with increasing delay.
 */
async function fetchResendInboundWithRetry(
  emailId: string,
  apiKey: string,
  maxAttempts: number = 5,
  initialDelayMs: number = 1500
): Promise<{ html: string; text: string; from: string; attachments: any[] }> {
  let lastError: any = null
  let delay = initialDelayMs

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const emailResponse = await axios.get(
        `https://api.resend.com/emails/receiving/${emailId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } }
      )
      const emailData = emailResponse.data
      return {
        html: emailData.html || "",
        text: emailData.text || "",
        from: emailData.from || "",
        attachments: emailData.attachments || [],
      }
    } catch (err: any) {
      lastError = err
      const status = err?.response?.status
      // Retry on 404 (not yet indexed) and 5xx. Fail fast on 401/403.
      if (status === 401 || status === 403) {
        throw err
      }
      if (attempt < maxAttempts) {
        console.log(
          `[SupportBox] Resend API fetch attempt ${attempt}/${maxAttempts} failed (status=${status || "n/a"}), retrying in ${delay}ms...`
        )
        await sleep(delay)
        delay = Math.min(delay * 2, 15_000)
      }
    }
  }
  throw lastError
}

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
    let bodyFetchFailed = false
    let inboundAttachments: { filename: string; size: number; content_type: string; content?: string }[] = []

    if (config.resend_api_key) {
      try {
        const fetched = await fetchResendInboundWithRetry(emailId, config.resend_api_key)
        emailHtml = fetched.html
        emailText = fetched.text
        // Try to extract name from "Name <email>" format in from
        const nameMatch = (fetched.from || fromAddress).match(/^(.+?)\s*</)
        fromName = nameMatch ? nameMatch[1].trim() : ""

        // Fetch attachments from dedicated endpoint
        const emailData = { attachments: fetched.attachments }
        if (emailData.attachments && emailData.attachments.length > 0) {
          try {
            const attResponse = await axios.get(
              `https://api.resend.com/emails/receiving/${emailId}/attachments`,
              {
                headers: { Authorization: `Bearer ${config.resend_api_key}` },
              }
            )
            const attList = attResponse.data?.data || []
            for (const att of attList) {
              if (att.download_url) {
                try {
                  const dlResponse = await axios.get(att.download_url, {
                    responseType: "arraybuffer",
                  })
                  const base64 = Buffer.from(dlResponse.data).toString("base64")
                  inboundAttachments.push({
                    filename: att.filename || "attachment",
                    size: att.size || dlResponse.data.byteLength,
                    content_type: att.content_type || "application/octet-stream",
                    content: base64,
                  })
                } catch (dlErr: any) {
                  // Store metadata even if download fails
                  inboundAttachments.push({
                    filename: att.filename || "attachment",
                    size: att.size || 0,
                    content_type: att.content_type || "application/octet-stream",
                  })
                  console.log(`[SupportBox] Failed to download attachment ${att.filename}: ${dlErr.message}`)
                }
              }
            }
          } catch (attErr: any) {
            console.log(`[SupportBox] Failed to fetch attachments: ${attErr.message}`)
          }
        }
      } catch (fetchError: any) {
        const status = fetchError?.response?.status
        console.log(
          `[SupportBox] Failed to fetch email content after retries for email_id=${emailId}: status=${status || "n/a"} message=${fetchError.message}`
        )
        // Continue without body — at least create the ticket so it's visible.
        // The ticket is marked body_fetch_failed so it can be re-fetched later.
        bodyFetchFailed = true
        emailText = "(email body could not be loaded — will retry)"
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
      // Reopen if it was solved/old/read
      if (ticket.status === "solved" || ticket.status === "old" || ticket.status === "read") {
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
      metadata: {
        resend_email_id: emailId,
        ...(bodyFetchFailed ? { body_fetch_failed: true, body_fetch_failed_at: new Date().toISOString() } : {}),
        ...(inboundAttachments.length > 0 ? { attachments: inboundAttachments } : {}),
      },
    })

    // Generate AI labels (non-blocking — don't delay webhook response)
    generateAiLabels({
      subject,
      bodyText: emailText || stripHtmlTags(emailHtml),
      emailAddress: toAddress,
      configDisplayName: config.display_name,
    }).then(async (labels) => {
      if (labels) {
        try {
          const existingMeta = ticket.metadata || {}
          await supportboxService.updateSupportboxTickets({
            id: ticket.id,
            metadata: { ...existingMeta, ai_labels: labels },
          })
        } catch (e) {
          console.log(`[SupportBox] Failed to save AI labels: ${(e as Error).message}`)
        }
      }
    }).catch((e) => {
      console.log(`[SupportBox] AI label generation failed: ${(e as Error).message}`)
    })

    console.log(`[SupportBox] Inbound email processed: ticket=${ticket.id}, from=${cleanFrom}, subject=${subject}`)
    res.status(200).json({ ticket, message })
  } catch (error: any) {
    console.error(`[SupportBox] Webhook error:`, error.message)
    res.status(500).json({ error: error.message })
  }
}
