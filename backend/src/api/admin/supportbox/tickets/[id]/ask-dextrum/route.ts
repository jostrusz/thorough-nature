// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../../modules/supportbox"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Anthropic from "@anthropic-ai/sdk"
import axios from "axios"

/**
 * POST /admin/supportbox/tickets/:id/ask-dextrum
 *
 * 1. Fetches the ticket + all messages + matched orders
 * 2. Sends full context to Claude Haiku for warehouse-oriented summarization
 * 3. Posts the structured request to the Dextrum Slack channel via Incoming Webhook
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  const DEXTRUM_WEBHOOK_URL = process.env.DEXTRUM_SLACK_WEBHOOK_URL
  if (!DEXTRUM_WEBHOOK_URL) {
    res.status(500).json({ error: "DEXTRUM_SLACK_WEBHOOK_URL is not configured" })
    return
  }

  const DAVID_SLACK_ID = process.env.DEXTRUM_SLACK_DAVID_ID || ""

  try {
    // ── 1. Fetch ticket + messages + orders ──
    const ticket = await supportboxService.retrieveSupportboxTicket(id)
    const messages = await supportboxService.listSupportboxMessages(
      { ticket_id: id },
      { order: { created_at: "ASC" } }
    )

    let allOrders: any[] = []
    if (ticket.from_email) {
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: [
            "id", "display_id", "status", "email", "total", "currency_code",
            "created_at", "canceled_at", "metadata",
            "items.*",
            "fulfillments.*", "fulfillments.labels.*",
            "shipping_address.*",
            "payment_collections.*", "payment_collections.payments.*",
            "payment_collections.payments.captures.*",
            "payment_collections.payments.refunds.*",
          ],
          filters: { email: ticket.from_email },
          pagination: { order: { created_at: "DESC" }, skip: 0, take: 200 },
        })
        allOrders = orders || []
      } catch (e) {
        // Order matching is best-effort
      }
    }

    // ── 2. Build context for Claude ──
    const stripHtml = (html: string) =>
      html?.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim() || ""

    const conversationThread = messages.map((m: any) => {
      const direction = m.direction === "inbound" ? "CUSTOMER" : "SUPPORT"
      const body = m.body_text || stripHtml(m.body_html) || "(empty)"
      const date = new Date(m.created_at).toISOString().slice(0, 16).replace("T", " ")
      return `[${date}] ${direction}: ${body}`
    }).join("\n\n---\n\n")

    const maxChars = 12000
    const truncatedConversation = conversationThread.length > maxChars
      ? "... (earlier messages truncated) ...\n\n" + conversationThread.slice(-maxChars)
      : conversationThread

    const orderContext = allOrders.map((o: any) => {
      const payments = (o.payment_collections || []).flatMap(
        (pc: any) => (pc.payments || []).map((p: any) => ({
          provider: p.provider_id,
          captured: !!p.captured_at,
          refunds: (p.refunds || []).length,
        }))
      )
      const items = (o.items || []).map((i: any) => `${i.quantity}x ${i.title}`).join(", ")
      const addr = o.shipping_address
      const address = addr ? `${addr.first_name} ${addr.last_name}, ${addr.address_1}, ${addr.postal_code} ${addr.city}, ${addr.country_code?.toUpperCase()}` : "N/A"

      return [
        `Order #${o.display_id} (${o.status}) — ${o.currency_code?.toUpperCase()} ${(o.total / 100).toFixed(2)}`,
        `  Items: ${items}`,
        `  Shipping: ${address}`,
        `  Payment: ${payments.map((p: any) => `${p.provider} (${p.captured ? "paid" : "unpaid"}${p.refunds > 0 ? ", refunded" : ""})`).join(", ") || "N/A"}`,
        `  Delivery: ${o.metadata?.dextrum_status || "unknown"}`,
        o.metadata?.dextrum_tracking_link ? `  Tracking: ${o.metadata.dextrum_tracking_link}` : null,
        `  Created: ${new Date(o.created_at).toISOString().slice(0, 10)}`,
      ].filter(Boolean).join("\n")
    }).join("\n\n")

    const systemPrompt = `You are a logistics coordinator for an e-commerce company selling books across Europe (NL, DE, BE, SE, PL, CZ).

You are preparing a request for the warehouse/fulfillment team (Dextrum). They can: contact the courier, modify orders, cancel shipments, resend packages, update tracking, arrange returns.

Analyze the support ticket and produce a clear warehouse action request. Everything MUST be in English — translate any non-English content.

Return a JSON object with these fields:
- "subject_en": translate the ticket subject to English (short, max 10 words)
- "problem": concise description of the issue in 1-2 sentences, focused on the logistics/shipping aspect. Use Slack formatting: *bold* for key facts (order numbers, tracking numbers, addresses), _italic_ for context.
- "customer_name": full name
- "customer_email": email address
- "customer_country": 2-letter country code
- "order_number": most relevant order number as string (e.g. "#634") or "N/A"
- "customer_address": full shipping address or "N/A"
- "payment_info": payment method + amount (e.g. "PayPal — €35.00") or "N/A"
- "delivery_status": current delivery status or "N/A"
- "tracking_number": tracking number if available, or "N/A"
- "tracking_link": tracking URL if available, or "N/A"
- "request": array of 2-4 short action strings — what you need the warehouse team to do. Each should be a direct instruction, max 15 words. Use *bold* for the key action. These are instructions for the warehouse, not customer support.
- "urgency": "low" | "medium" | "high"

Focus on what the warehouse team needs to DO — contact courier, resend, cancel, check status, etc.
Return ONLY valid JSON, no markdown.`

    const userMessage = `=== TICKET INFO ===
Subject: ${ticket.subject}
From: ${ticket.from_name} <${ticket.from_email}>
Status: ${ticket.status}
Created: ${new Date(ticket.created_at).toISOString().slice(0, 16)}

=== CONVERSATION (${messages.length} messages) ===
${truncatedConversation}

=== CUSTOMER ORDERS (${allOrders.length} found) ===
${orderContext || "No orders found for this email"}
`

    // ── 3. Call Claude Haiku ──
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    })

    let aiText = response.content[0].type === "text" ? response.content[0].text : ""
    aiText = aiText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
    const summary = JSON.parse(aiText)

    // ── 4. Send to Dextrum Slack channel ──
    const urgencyDot: Record<string, string> = { low: ":large_blue_circle:", medium: ":large_yellow_circle:", high: ":red_circle:" }
    const adminUrl = process.env.MEDUSA_ADMIN_URL || "https://backend-production-aefbc.up.railway.app/app"
    const email = summary.customer_email || ticket.from_email || "N/A"
    const steps = (summary.request || []).map((s: string, i: number) => `    ${i + 1}. ${s}`).join("\n")

    const davidMention = DAVID_SLACK_ID ? `<@${DAVID_SLACK_ID}>` : "David Majer"

    const customerLine = [
      summary.customer_name,
      summary.customer_country ? `(${summary.customer_country})` : null,
    ].filter(Boolean).join(" ")

    const detailParts = [
      summary.order_number && summary.order_number !== "N/A" ? `Order ${summary.order_number}` : null,
      summary.payment_info && summary.payment_info !== "N/A" ? summary.payment_info : null,
      summary.delivery_status && summary.delivery_status !== "N/A" ? `Delivery: ${summary.delivery_status}` : null,
      summary.tracking_number && summary.tracking_number !== "N/A"
        ? (summary.tracking_link && summary.tracking_link !== "N/A"
          ? `<${summary.tracking_link}|Tracking: ${summary.tracking_number}>`
          : `Tracking: ${summary.tracking_number}`)
        : null,
    ].filter(Boolean).join("  ·  ")

    const slackPayload = {
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `${urgencyDot[summary.urgency] || ":white_circle:"}  *${summary.subject_en || ticket.subject}*\n${davidMention} — action needed`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*${email}*\n${customerLine}${summary.customer_address && summary.customer_address !== "N/A" ? `\n${summary.customer_address}` : ""}`,
          },
        },
        ...(detailParts ? [{
          type: "context" as const,
          elements: [{ type: "mrkdwn" as const, text: detailParts }],
        }] : []),
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*Problem*\n${summary.problem}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `*What we need*\n${steps}`,
          },
        },
        { type: "divider" },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `<${adminUrl}/supportbox/${id}|Open in SupportBox>`,
            },
          ],
        },
      ],
    }

    const slackResponse = await axios.post(DEXTRUM_WEBHOOK_URL, slackPayload, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    })

    logger.info(`[SupportBox] Dextrum request sent to Slack for ticket ${id}`)

    res.json({
      success: true,
      summary,
      slack_status: slackResponse.status,
    })
  } catch (error: any) {
    logger.error(`[SupportBox] Ask-Dextrum failed: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
}
