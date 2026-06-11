// @ts-nocheck
/**
 * POST /admin/huset/orders/:id/send — manually send an order to the Huset WMS
 * (bypasses the hold window; payment must still be confirmed unless force=true).
 * :id is the Medusa order id.
 */
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { HUSET_MODULE } from "../../../../../../modules/huset"
import { getHusetConfig } from "../../../../../../modules/huset/config"
import { sendOrderToHuset } from "../../../../../../modules/huset/send-order"

export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const orderId = req.params.id
    const force = (req.body as any)?.force === true
    const config = getHusetConfig()
    const husetService = req.scope.resolve(HUSET_MODULE) as any
    const query = req.scope.resolve("query") as any

    const maps = await husetService.listHusetOrderMaps({ medusa_order_id: orderId }, { take: 1 })
    let orderMap = maps[0]

    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "email", "currency_code", "total", "sales_channel_id",
        "metadata", "items.*", "items.variant.*", "items.variant.product.*",
        "shipping_address.*", "billing_address.*", "shipping_methods.*",
        "payment_collections.*", "payment_collections.payments.*",
      ],
      filters: { id: orderId },
    })
    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // Create map on the fly if subscriber missed it (e.g. order placed before deploy)
    if (!orderMap) {
      const countryCode = (
        (order as any).shipping_address?.country_code ||
        (order as any).billing_address?.country_code || "XX"
      ).toUpperCase()
      const orderRef = (order as any).metadata?.custom_order_number
        || `${countryCode}${new Date().getFullYear()}-${(order as any).display_id}`
      orderMap = await husetService.createHusetOrderMaps({
        medusa_order_id: orderId,
        display_id: String((order as any).display_id),
        project_code: (order as any).metadata?.project_code || "DEFAULT",
        order_ref: orderRef,
        delivery_status: "WAITING",
        delivery_status_updated_at: new Date().toISOString(),
      })
    }

    if (orderMap.outgoing_delivery_order_id) {
      res.status(400).json({
        error: `Order already sent to Huset (OutgoingDeliveryOrderId: ${orderMap.outgoing_delivery_order_id})`,
      })
      return
    }

    // Payment gate (force=true overrides — e.g. replacement shipments)
    const paidStatuses = ["captured", "completed", "authorized"]
    const isPaid = ((order as any).payment_collections || []).some(
      (pc: any) => paidStatuses.includes(pc.status)
    )
    const isCOD = (order as any).metadata?.payment_method === "cod"
    if (!isPaid && !isCOD && !force) {
      res.status(400).json({ error: "Order is not paid. Pass { \"force\": true } to send anyway." })
      return
    }

    const result = await sendOrderToHuset({ order, orderMap, husetService, config })
    res.json({ success: true, ...result })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
