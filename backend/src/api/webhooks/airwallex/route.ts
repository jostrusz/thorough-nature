// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { IPaymentModuleService } from "@medusajs/framework/types"
import { AIRWALLEX_MODULE_NAME } from "@medusajs/payment-airwallex"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { name: event_type, data: eventData } = req.body

    if (!event_type || !eventData) {
      return res.status(400).json({ error: "Missing required Airwallex webhook fields" })
    }

    const paymentModuleService: IPaymentModuleService = req.scope.resolve(
      "paymentModuleService"
    )
    const orderModuleService = req.scope.resolve("orderModuleService")
    const logger = req.scope.resolve("logger")

    // Get the Airwallex payment provider
    const airwallexProvider = paymentModuleService.getProvider(AIRWALLEX_MODULE_NAME)

    if (!airwallexProvider) {
      logger.error("[Airwallex Webhook] Provider not found")
      return res.status(500).json({ error: "Provider not configured" })
    }

    const { id: paymentIntentId, status: intentStatus } = eventData

    if (!paymentIntentId) {
      logger.warn("[Airwallex Webhook] No payment intent ID in event data")
      return res.status(200).json({ received: true })
    }

    // Find the order with this Airwallex payment intent ID
    const orders = await orderModuleService.list({
      filters: {
        "metadata.airwallexPaymentIntentId": paymentIntentId,
      },
    })

    if (!orders.length) {
      logger.warn(
        `[Airwallex Webhook] No order found for payment intent: ${paymentIntentId}`
      )
      return res.status(200).json({ received: true })
    }

    const order = orders[0]
    const medusaStatus = mapAirwallexEventToMedusaStatus(event_type)

    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: mapAirwallexEventToActivityEvent(event_type),
      gateway: "airwallex",
      payment_method: eventData.payment_method || "card",
      status: ["payment_intent.succeeded"].includes(event_type)
        ? "success"
        : "pending",
      amount: eventData.amount,
      currency: eventData.currency,
      transaction_id: paymentIntentId,
      detail: `Airwallex event: ${event_type}`,
    }

    // Update order metadata with activity log
    const existingLog = order.metadata?.payment_activity_log || []
    await orderModuleService.updateOrders(
      {
        id: order.id,
        metadata: {
          ...order.metadata,
          payment_activity_log: [...existingLog, activityEntry],
          airwallexPaymentIntentId: paymentIntentId,
          airwallexStatus: event_type,
        },
      },
      { transactionManager: req.scope.resolve("manager") }
    )

    logger.info(
      `[Airwallex Webhook] Order ${order.id} updated with event: ${event_type}`
    )

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Airwallex Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}

function mapAirwallexEventToMedusaStatus(event_type: string): string {
  const statusMap: Record<string, string> = {
    "payment_intent.succeeded": "captured",
    "payment_intent.requires_capture": "authorized",
    "refund.succeeded": "refunded",
  }
  return statusMap[event_type] || "pending"
}

function mapAirwallexEventToActivityEvent(event_type: string): string {
  const eventMap: Record<string, string> = {
    "payment_intent.succeeded": "capture",
    "payment_intent.requires_capture": "authorization",
    "refund.succeeded": "refund",
  }
  return eventMap[event_type] || "status_update"
}
