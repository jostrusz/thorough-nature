// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SUPPORTBOX_MODULE } from "../../../../../modules/supportbox"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const supportboxService = req.scope.resolve(SUPPORTBOX_MODULE) as any
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params

  try {
    const ticket = await supportboxService.retrieveSupportboxTicket(id)

    // Load messages separately (models don't define ORM relations)
    const messages = await supportboxService.listSupportboxMessages(
      { ticket_id: id },
      { order: { created_at: "ASC" } }
    )
    ticket.messages = messages

    // Fetch ALL orders for customer by email — with rich data
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
            "billing_address.*",
            "payment_collections.*", "payment_collections.payments.*",
            "payment_collections.payments.captures.*",
            "payment_collections.payments.refunds.*",
          ],
          filters: { email: ticket.from_email },
          pagination: { order: { created_at: "DESC" }, skip: 0, take: 200 },
        })
        allOrders = (orders || []).map((order: any) => {
          // Resolve payment status from payment collections
          const payments = (order.payment_collections || []).flatMap(
            (pc: any) => (pc.payments || []).map((p: any) => ({
              id: p.id,
              amount: p.amount,
              currency_code: p.currency_code,
              provider_id: p.provider_id,
              captured_at: p.captured_at,
              canceled_at: p.canceled_at,
              created_at: p.created_at,
              refunds: (p.refunds || []).map((r: any) => ({
                id: r.id,
                amount: r.amount,
                note: r.note,
                created_at: r.created_at,
              })),
            }))
          )
          const paymentStatus = payments.some((p: any) => p.captured_at)
            ? "paid"
            : payments.some((p: any) => p.canceled_at)
              ? "canceled"
              : payments.length > 0 ? "awaiting" : "unknown"

          const shippingAddr = order.shipping_address ? {
            first_name: order.shipping_address.first_name,
            last_name: order.shipping_address.last_name,
            address_1: order.shipping_address.address_1,
            address_2: order.shipping_address.address_2,
            city: order.shipping_address.city,
            postal_code: order.shipping_address.postal_code,
            province: order.shipping_address.province,
            country_code: order.shipping_address.country_code,
            phone: order.shipping_address.phone,
            company: order.shipping_address.company,
          } : null

          return {
            order_id: order.id,
            display_id: order.display_id,
            status: order.status,
            total: order.total,
            currency_code: order.currency_code,
            created_at: order.created_at,
            canceled_at: order.canceled_at || null,
            email: order.email,
            payment_status: paymentStatus,
            payments,
            shipping_address: shippingAddr,
            delivery_status: order.metadata?.dextrum_status || null,
            wms_order_code: order.metadata?.dextrum_order_code || null,
            wms_sent_at: order.metadata?.dextrum_sent_at || null,
            tracking_number: order.metadata?.dextrum_tracking_number || null,
            tracking_link: order.metadata?.dextrum_tracking_link || null,
            carrier: order.metadata?.dextrum_carrier || null,
            payment_provider: order.metadata?.payment_provider || null,
            payment_id: order.metadata?.payment_id_override || order.metadata?.stripePaymentIntentId || order.metadata?.molliePaymentId || order.metadata?.airwallexPaymentIntentId || order.metadata?.paypalOrderId || order.metadata?.comgateTransId || null,
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
          }
        })
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
