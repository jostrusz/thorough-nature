// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../modules/supportbox"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const { config_id, status, q } = req.query as any

  try {
    const filters: any = {}
    if (config_id) filters.config_id = config_id
    if (status && status !== "all" && status !== "inbox") filters.status = status

    let tickets = await supportboxService.listSupportboxTickets(filters, {
      order: { created_at: "DESC" },
    })

    // Exclude spam from non-spam views (inbox, new, solved, old, all)
    if (status !== "spam") {
      tickets = tickets.filter((t: any) => t.status !== "spam")
    }

    // Load messages separately (models don't define ORM relations)
    const allMessages = await supportboxService.listSupportboxMessages({}, {
      order: { created_at: "ASC" },
    })

    // Index messages by ticket_id
    const messagesByTicket: Record<string, any[]> = {}
    for (const msg of allMessages) {
      if (!messagesByTicket[msg.ticket_id]) messagesByTicket[msg.ticket_id] = []
      messagesByTicket[msg.ticket_id].push(msg)
    }

    // Attach messages to tickets
    tickets = tickets.map((t: any) => ({
      ...t,
      messages: messagesByTicket[t.id] || [],
    }))

    // Fulltext search: subject, from_email, from_name, and message body content
    if (q) {
      const query = (q as string).toLowerCase()
      tickets = tickets.filter(
        (t: any) =>
          t.subject?.toLowerCase().includes(query) ||
          t.from_email?.toLowerCase().includes(query) ||
          t.from_name?.toLowerCase().includes(query) ||
          (t.messages || []).some((m: any) =>
            m.body_text?.toLowerCase().includes(query) ||
            m.body_html?.replace(/<[^>]*>/g, "").toLowerCase().includes(query)
          )
      )
    }

    res.json({ tickets })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
