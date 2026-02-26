// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../modules/supportbox"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const body = req.body as any

  try {
    const { to, from, from_name, subject, body_html, body_text } = body

    // Find config by email address
    const configs = await supportboxService.listSupportboxConfigs({
      email_address: to,
    })

    const config = configs[0]
    if (!config) {
      return res.status(400).json({ error: "Config not found for email address" })
    }

    // Find existing ticket by thread key or create new one
    const threadKey = `${from}|${subject.toLowerCase().replace(/^re:\s*/i, "")}`
    const existingTickets = await supportboxService.listSupportboxTickets({
      thread_key: threadKey,
      config_id: config.id,
    })

    let ticket
    if (existingTickets.length > 0) {
      ticket = existingTickets[0]
      // Reopen if it was solved
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
        from_email: from,
        from_name: from_name,
        subject,
        thread_key: threadKey,
        status: "new",
      })

      // Auto-match order by email
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["id", "customer_id"],
          filters: { email: from },
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

    // Create inbound message
    const message = await supportboxService.createSupportboxMessages({
      ticket_id: ticket.id,
      direction: "inbound",
      from_email: from,
      from_name: from_name,
      body_html: body_html || "",
      body_text: body_text,
    })

    res.status(200).json({ ticket, message })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
