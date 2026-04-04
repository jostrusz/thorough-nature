// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../../modules/supportbox"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import Anthropic from "@anthropic-ai/sdk"
import axios from "axios"

/**
 * POST /admin/supportbox/tickets/:id/summarize-slack
 *
 * 1. Fetches the ticket + all messages + matched orders
 * 2. Sends full context to Claude Sonnet for summarization
 * 3. Posts the structured summary to Slack via Incoming Webhook
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL
  if (!SLACK_WEBHOOK_URL) {
    res.status(500).json({ error: "SLACK_WEBHOOK_URL is not configured" })
    return
  }

  try {
    // ── 1. Fetch ticket + messages + orders ──
    const ticket = await supportboxService.retrieveSupportboxTicket(id)
    const messages = await supportboxService.listSupportboxMessages(
      { ticket_id: id },
      { order: { created_at: "ASC" } }
    )

    // Fetch orders for this customer
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
          pagination: { order: { created_at: "DESC" } },
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

    // Truncate if too long (keep last messages if over limit)
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

    const systemPrompt = `You are a customer support analyst for an e-commerce company selling books across Europe (NL, DE, BE, SE, PL, CZ).

Analyze the support ticket and produce a clear, actionable summary in ENGLISH.

Return a JSON object with these fields:
- "problem": 2-3 sentence description of the customer's problem
- "customer_name": full name of the customer
- "customer_email": email address
- "customer_country": country (from shipping address or email domain or language)
- "customer_orders": array of order numbers mentioned or related (e.g. ["#1234", "#5678"])
- "customer_address": full shipping address if available, or "N/A"
- "customer_payment_method": payment method used (e.g. "PayPal", "Credit Card", "iDEAL")
- "customer_total_spent": total amount across all orders if available
- "action_needed": specific step-by-step recommendation what the support team should do to resolve this
- "urgency": "low" | "medium" | "high"
- "category": one of: payment, shipping, refund, product_question, complaint, returns, technical, other
- "delivery_status": current delivery status if known from order data

Be specific and practical. Reference order numbers, dates, tracking links where relevant.
Return ONLY valid JSON, no markdown, no explanation.`

    const userMessage = `=== TICKET INFO ===
Subject: ${ticket.subject}
From: ${ticket.from_name} <${ticket.from_email}>
Status: ${ticket.status}
Created: ${new Date(ticket.created_at).toISOString().slice(0, 16)}
AI Labels: project=${ticket.ai_project || "?"}, category=${ticket.ai_category || "?"}

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

    // ── 4. Send to Slack ──
    const urgencyEmoji = { low: ":large_blue_circle:", medium: ":large_yellow_circle:", high: ":red_circle:" }
    const categoryEmoji: Record<string, string> = {
      payment: ":credit_card:", shipping: ":package:", refund: ":money_with_wings:",
      product_question: ":books:", complaint: ":warning:", returns: ":leftwards_arrow_with_hook:",
      technical: ":wrench:", other: ":grey_question:",
    }
    const adminUrl = process.env.MEDUSA_ADMIN_URL || "https://backend-production-aefbc.up.railway.app/app"

    const ordersList = (summary.customer_orders || []).join(", ") || "N/A"

    const slackPayload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: `:ticket: ${ticket.subject}`,
            emoji: true,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `${urgencyEmoji[summary.urgency] || ":white_circle:"} *Urgency:* \`${summary.urgency?.toUpperCase()}\`  ${categoryEmoji[summary.category] || ""} *Category:* \`${summary.category}\``,
            ].join("\n"),
          },
        },
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: [
              `:bust_in_silhouette: *Customer Info*`,
              `>:person_frowning: *Name:* ${summary.customer_name || "N/A"}`,
              `>:email: *Email:* ${summary.customer_email || ticket.from_email || "N/A"}`,
              `>:earth_americas: *Country:* ${summary.customer_country || "N/A"}`,
              `>:house: *Address:* ${summary.customer_address || "N/A"}`,
              `>:shopping_trolley: *Orders:* ${ordersList}`,
              `>:credit_card: *Payment:* ${summary.customer_payment_method || "N/A"}`,
              `>:moneybag: *Total spent:* ${summary.customer_total_spent || "N/A"}`,
              `>:truck: *Delivery status:* ${summary.delivery_status || "N/A"}`,
            ].join("\n"),
          },
        },
        { type: "divider" },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:rotating_light: *Problem*\n${summary.problem}`,
          },
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:white_check_mark: *Action Needed*\n${summary.action_needed}`,
          },
        },
        { type: "divider" },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: `:link: Ticket \`${id}\` | <${adminUrl}/supportbox/${id}|Open in SupportBox>`,
            },
          ],
        },
      ],
    }

    const slackResponse = await axios.post(SLACK_WEBHOOK_URL, slackPayload, {
      headers: { "Content-Type": "application/json" },
      timeout: 5000,
    })

    logger.info(`[SupportBox] AI summary sent to Slack for ticket ${id}`)

    res.json({
      success: true,
      summary,
      slack_status: slackResponse.status,
    })
  } catch (error: any) {
    logger.error(`[SupportBox] Summarize-to-Slack failed: ${error.message}`)
    res.status(500).json({ error: error.message })
  }
}
