// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../modules/supportbox"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  try {
    const ticket = await supportboxService.retrieveSupportboxTicket(id, {
      relations: ["messages"],
    })

    // Auto-match order by email
    let matchedOrder = null
    if (ticket.from_email) {
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: ["id", "display_id", "status", "email", "total", "currency_code", "metadata", "items.*"],
          filters: { email: ticket.from_email },
          pagination: { take: 1, order: { created_at: "DESC" } },
        })
        if (orders && orders.length > 0) {
          const order = orders[0]
          matchedOrder = {
            order_id: order.id,
            display_id: order.display_id,
            status: order.status,
            total: order.total,
            currency_code: order.currency_code,
            delivery_status: order.metadata?.dextrum_status || "pending",
            items: (order.items || []).map((i: any) => ({ title: i.title, quantity: i.quantity })),
          }
        }
      } catch (e) {
        // Order matching is best-effort
      }
    }

    res.json({ ticket, matchedOrder })
  } catch (error: any) {
    res.status(404).json({ error: "Ticket not found" })
  }
}
