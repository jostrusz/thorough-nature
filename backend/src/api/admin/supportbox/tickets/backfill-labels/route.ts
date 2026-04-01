// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../modules/supportbox"
import { generateAiLabels } from "../../../../webhooks/supportbox/ai-label"

/**
 * POST /admin/supportbox/tickets/backfill-labels
 *
 * Generate AI labels for all tickets that don't have them yet.
 * Processes tickets sequentially to avoid rate limits.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any

  try {
    // Get all tickets
    const tickets = await supportboxService.listSupportboxTickets({}, {
      order: { created_at: "DESC" },
    })

    // Get all configs for display name lookup
    const configs = await supportboxService.listSupportboxConfigs({})
    const configMap: Record<string, any> = {}
    for (const c of configs) configMap[c.id] = c

    // Filter tickets without AI labels
    const needsLabels = tickets.filter(
      (t: any) => !t.metadata?.ai_labels
    )

    if (needsLabels.length === 0) {
      return res.json({ message: "All tickets already have AI labels", processed: 0 })
    }

    // Get all messages for context
    const allMessages = await supportboxService.listSupportboxMessages({}, {
      order: { created_at: "ASC" },
    })
    const messagesByTicket: Record<string, any[]> = {}
    for (const msg of allMessages) {
      if (!messagesByTicket[msg.ticket_id]) messagesByTicket[msg.ticket_id] = []
      messagesByTicket[msg.ticket_id].push(msg)
    }

    let processed = 0
    let failed = 0
    const results: { id: string; subject: string; labels: any }[] = []

    // Process sequentially (avoid rate limits)
    for (const ticket of needsLabels) {
      const config = configMap[ticket.config_id]
      if (!config) continue

      // Get first inbound message for context
      const msgs = messagesByTicket[ticket.id] || []
      const firstInbound = msgs.find((m: any) => m.direction === "inbound") || msgs[0]
      const bodyText = firstInbound?.body_text
        || firstInbound?.body_html?.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
        || ""

      try {
        const labels = await generateAiLabels({
          subject: ticket.subject,
          bodyText: bodyText.substring(0, 1000), // Limit to 1000 chars
          emailAddress: config.email_address,
          configDisplayName: config.display_name,
        })

        if (labels) {
          const existingMeta = ticket.metadata || {}
          await supportboxService.updateSupportboxTickets({
            id: ticket.id,
            metadata: { ...existingMeta, ai_labels: labels },
          })
          processed++
          results.push({ id: ticket.id, subject: ticket.subject, labels })
        } else {
          failed++
        }
      } catch (e: any) {
        console.log(`[SupportBox] Backfill failed for ${ticket.id}: ${e.message}`)
        failed++
      }

      // Small delay to avoid rate limits (100ms between calls)
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    res.json({
      message: `Backfill complete`,
      total: needsLabels.length,
      processed,
      failed,
      results,
    })
  } catch (error: any) {
    console.error("[SupportBox] Backfill error:", error.message)
    res.status(500).json({ error: error.message })
  }
}
