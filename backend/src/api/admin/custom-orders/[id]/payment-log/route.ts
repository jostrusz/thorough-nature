// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * GET /admin/custom-orders/:id/payment-log
 *
 * Returns the payment activity log for an order.
 * Includes all webhook events, failure reasons, and payment lifecycle.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const orderId = req.params.id
    if (!orderId) {
      return res.status(400).json({ error: "Missing order ID" })
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "metadata", "created_at", "currency_code", "total"],
      filters: { id: orderId },
    })

    const order = orders?.[0]
    if (!order) {
      return res.status(404).json({ error: "Order not found" })
    }

    const paymentLog = order.metadata?.payment_activity_log || []
    const paymentStatus = {
      gateway: order.metadata?.payment_provider || order.metadata?.payment_method || null,
      captured: order.metadata?.payment_captured || false,
      stripe_status: order.metadata?.stripeStatus || null,
      mollie_status: order.metadata?.mollieStatus || null,
      klarna_status: order.metadata?.klarnaStatus || null,
      paypal_status: order.metadata?.paypalStatus || null,
      airwallex_status: order.metadata?.airwallexStatus || null,
      comgate_status: order.metadata?.comgateStatus || null,
      p24_status: order.metadata?.p24Status || null,
    }

    // Filter out null statuses
    const activeStatuses = Object.fromEntries(
      Object.entries(paymentStatus).filter(([, v]) => v !== null && v !== undefined)
    )

    return res.status(200).json({
      order_id: order.id,
      display_id: order.display_id,
      created_at: order.created_at,
      currency: order.currency_code,
      total: order.total,
      payment_status: activeStatuses,
      payment_log: paymentLog,
      event_count: paymentLog.length,
    })
  } catch (error: any) {
    return res.status(500).json({ error: error.message })
  }
}
