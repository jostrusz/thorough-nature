// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { emitPaymentLog } from "../../../utils/payment-logger"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const { name: event_type, data: eventData } = req.body

    if (!event_type || !eventData) {
      return res.status(400).json({ error: "Missing required Airwallex webhook fields" })
    }

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

    const isFailed = event_type.includes("failed") || event_type.includes("cancelled")
    const latestAttempt = intentData.latest_payment_attempt
    const activityEntry: any = {
      timestamp: new Date().toISOString(),
      event: mapAirwallexEventToActivityEvent(event_type),
      gateway: "airwallex",
      payment_method: latestAttempt?.payment_method?.type || intentData.payment_method_type || "card",
      status: ["payment_intent.succeeded"].includes(event_type)
        ? "success"
        : isFailed ? "failed" : "pending",
      amount: intentData.amount,
      currency: intentData.currency,
      transaction_id: paymentIntentId,
      webhook_event_type: event_type,
      provider_raw_status: intentData.status,
      customer_email: intentData.metadata?.customer_email || null,
      detail: `Airwallex event: ${event_type}`,
    }

    if (isFailed) {
      activityEntry.error_code = latestAttempt?.status || intentData.status || "unknown"
      activityEntry.decline_reason = latestAttempt?.failure_reason || intentData.failure_reason || "Payment failed"
    }

    // Update order metadata with activity log
    const existingMeta = order.metadata || {}
    const existingLog = existingMeta.payment_activity_log || []
    // Update order metadata via direct DB query (orderModuleService not available in webhook context)
    const updatedMetadata: any = {
      ...existingMeta,
      payment_activity_log: [...existingLog, activityEntry],
      airwallexPaymentIntentId: paymentIntentId,
      airwallexStatus: event_type,
    }

    // Mark as captured when Airwallex confirms payment success
    if (event_type === "payment_intent.succeeded") {
      updatedMetadata.payment_captured = true
      updatedMetadata.payment_captured_at = new Date().toISOString()
      updatedMetadata.payment_airwallex_intent_id = paymentIntentId
    }
    try {
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      await pool.query(
        `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(updatedMetadata), order.id]
      )
      await pool.end()
    } catch (dbErr: any) {
      logger.warn(`[Airwallex Webhook] DB update failed: ${dbErr.message}`)
    }

    logger.info(
      `[Airwallex Webhook] Order ${order.id} updated with event: ${event_type}`
    )

    // Emit custom event when payment is captured so subscribers can react
    if (event_type === "payment_intent.succeeded") {
      try {
        const { ContainerRegistrationKeys } = await import("@medusajs/framework/utils")
        const eventBus = req.scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit("payment.captured", { id: order.id })
        logger.info(`[Airwallex Webhook] Emitted payment.captured event for order ${order.id}`)
      } catch (e: any) {
        logger.warn(`[Airwallex Webhook] Failed to emit payment.captured: ${e.message}`)
      }
    }

    emitPaymentLog(logger, {
      provider: "airwallex",
      event: event_type,
      order_id: order.id,
      transaction_id: paymentIntentId,
      status: activityEntry.status,
      amount: intentData.amount,
      currency: intentData.currency?.toUpperCase(),
      customer_email: activityEntry.customer_email,
      payment_method: activityEntry.payment_method,
      error_code: activityEntry.error_code,
      decline_reason: activityEntry.decline_reason,
      provider_raw_status: intentData.status,
    })

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
