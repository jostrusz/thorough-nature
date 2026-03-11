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

    // Fetch ALL orders for customer by email
    let allOrders: any[] = []
    if (ticket.from_email) {
      try {
        const { data: orders } = await query.graph({
          entity: "order",
          fields: [
            "id", "display_id", "status", "email", "total", "currency_code",
            "created_at", "metadata", "items.*",
            "fulfillments.*", "fulfillments.labels.*",
          ],
          filters: { email: ticket.from_email },
          pagination: { order: { created_at: "DESC" } },
        })
        allOrders = (orders || []).map((order: any) => ({
          order_id: order.id,
          display_id: order.display_id,
          status: order.status,
          total: order.total,
          currency_code: order.currency_code,
          created_at: order.created_at,
          delivery_status: order.metadata?.dextrum_status || null,
          tracking_number: order.metadata?.dextrum_tracking_number || null,
          tracking_link: order.metadata?.dextrum_tracking_link || null,
          carrier: order.metadata?.dextrum_carrier || null,
          fulfillments: (order.fulfillments || []).map((f: any) => ({
            id: f.id,
            created_at: f.created_at,
            shipped_at: f.shipped_at,
            delivered_at: f.delivered_at,
            labels: (f.labels || []).map((l: any) => ({
              tracking_number: l.tracking_number,
              tracking_url: l.tracking_url,
            })),
          })),
          items: (order.items || []).map((i: any) => ({
            title: i.title,
            quantity: i.quantity,
            unit_price: i.unit_price,
            thumbnail: i.thumbnail,
          })),
        }))
      } catch (e) {
        // Order matching is best-effort
      }
    }

    // Keep backward compat: matchedOrder = first order
    const matchedOrder = allOrders.length > 0 ? allOrders[0] : null

    res.json({ ticket, matchedOrder, allOrders })
  } catch (error: any) {
    res.status(404).json({ error: "Ticket not found" })
  }
}
