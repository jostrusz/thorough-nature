// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { KLARNA_MODULE_NAME } from "../../../modules/payment-klarna"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { event_type, order_id: klarnaOrderId } = req.body

    if (!event_type || !klarnaOrderId) {
      return res.status(400).json({ error: "Missing required Klarna webhook fields" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const logger = req.scope.resolve("logger")

    // Get the Klarna payment provider
    const klarnaProvider = paymentModuleService.getProvider(KLARNA_MODULE_NAME)

    if (!klarnaProvider) {
      logger.error("[Klarna Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    // Map Klarna event type to Medusa status
    const medusaStatus = mapKlarnaEventToMedusaStatus(event_type)

    // Find the order with this Klarna order ID
    const orders = await orderModuleService.list({
      filters: {
        "metadata.klarnaOrderId": klarnaOrderId,
      },
    })

    if (!orders.length) {
      logger.warn(`[Klarna Webhook] No order found for Klarna ID: ${klarnaOrderId}`)
      return res.status(200).json({ received: true })
    }

    const order = orders[0]

    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: mapKlarnaEventToActivityEvent(event_type),
      gateway: "klarna",
      payment_method: "klarna",
      status: ["order.authorized", "order.captured"].includes(event_type)
        ? "success"
        : "pending",
      amount: order.total || 0,
      currency: order.currency_code,
      transaction_id: klarnaOrderId,
      error_message:
        event_type === "order.cancelled"
          ? "Order cancelled by Klarna"
          : undefined,
      detail: `Klarna event: ${event_type}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          klarnaOrderId,
          klarnaStatus: event_type,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[Klarna Webhook] Order ${order.id} updated with event: ${event_type}`
    )

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Klarna Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}

function mapKlarnaEventToMedusaStatus(event_type: string): string {
  const statusMap: Record<string, string> = {
    "order.authorized": "authorized",
    "order.captured": "captured",
    "order.refunded": "refunded",
    "order.cancelled": "canceled",
  }
  return statusMap[event_type] || "pending"
}

function mapKlarnaEventToActivityEvent(event_type: string): string {
  const eventMap: Record<string, string> = {
    "order.authorized": "authorization",
    "order.captured": "capture",
    "order.refunded": "refund",
    "order.cancelled": "cancellation",
  }
  return eventMap[event_type] || "status_update"
}
