// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { name: event_type, data: eventData } = req.body

    if (!event_type || !eventData) {
      return res.status(400).json({ error: "Missing required Airwallex webhook fields" })
    }

    const orderModuleService = req.scope.resolve(Modules.ORDER)
    const logger = req.scope.resolve("logger")

    // Airwallex webhook data: the object is directly in `data` or nested in `data.object`
    const intentData = eventData.object || eventData
    const paymentIntentId = intentData.id

    if (!paymentIntentId) {
      logger.warn("[Airwallex Webhook] No payment intent ID in event data")
      return res.status(200).json({ received: true })
    }

    logger.info(`[Airwallex Webhook] Received event: ${event_type}, intent: ${paymentIntentId}`)

    // Find the order with this Airwallex payment intent ID via direct DB query
    // (metadata filtering not supported via orderModuleService.listOrders)
    let order = null
    try {
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      const { rows } = await pool.query(
        `SELECT id, metadata FROM "order"
         WHERE metadata->>'airwallexPaymentIntentId' = $1
         LIMIT 1`,
        [paymentIntentId]
      )
      await pool.end()
      if (rows[0]) {
        order = rows[0]
      }
    } catch (dbErr: any) {
      logger.warn(`[Airwallex Webhook] DB query failed: ${dbErr.message}`)
    }

    if (!order) {
      logger.warn(
        `[Airwallex Webhook] No order found for payment intent: ${paymentIntentId}`
      )
      return res.status(200).json({ received: true })
    }

    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: mapAirwallexEventToActivityEvent(event_type),
      gateway: "airwallex",
      payment_method: intentData.latest_payment_attempt?.payment_method?.type || intentData.payment_method_type || "card",
      status: ["payment_intent.succeeded"].includes(event_type)
        ? "success"
        : "pending",
      amount: intentData.amount,
      currency: intentData.currency,
      transaction_id: paymentIntentId,
      detail: `Airwallex event: ${event_type}`,
    }

    // Update order metadata with activity log
    const existingMeta = order.metadata || {}
    const existingLog = existingMeta.payment_activity_log || []
    await orderModuleService.updateOrders(order.id, {
      metadata: {
        ...existingMeta,
        payment_activity_log: [...existingLog, activityEntry],
        airwallexPaymentIntentId: paymentIntentId,
        airwallexStatus: event_type,
      },
    })

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

function mapAirwallexEventToActivityEvent(event_type: string): string {
  const eventMap: Record<string, string> = {
    "payment_intent.succeeded": "capture",
    "payment_intent.requires_capture": "authorization",
    "refund.succeeded": "refund",
  }
  return eventMap[event_type] || "status_update"
}
