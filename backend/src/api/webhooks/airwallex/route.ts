// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { emitPaymentLog } from "../../../utils/payment-logger"

/**
 * Helper: find order by Airwallex payment intent ID via direct DB query
 */
async function findOrderByIntentId(paymentIntentId: string, logger: any): Promise<any> {
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
    return rows[0] || null
  } catch (dbErr: any) {
    logger.warn(`[Airwallex Webhook] DB query failed: ${dbErr.message}`)
    return null
  }
}

/**
 * Safety net: auto-complete cart when Airwallex payment succeeded but no order exists.
 * This handles redirect methods (Bancontact, iDEAL, etc.) where the customer pays
 * but never returns to the checkout page (browser closed, connection lost, etc.).
 *
 * Flow:
 * 1. Wait 30s to give the frontend return handler a chance to complete first
 * 2. Re-check if an order was created during the delay (prevent duplicates)
 * 3. Find uncompleted cart by matching intentId in payment session data
 * 4. Complete the cart via Medusa's completeCartWorkflow
 */
async function safetyNetCompleteCart(
  paymentIntentId: string,
  intentData: any,
  scope: any,
  logger: any
): Promise<void> {
  const DELAY_MS = 30_000 // 30 seconds — give frontend time to complete

  logger.info(
    `[Airwallex Webhook] Safety net: no order found for intent ${paymentIntentId}. ` +
    `Waiting ${DELAY_MS / 1000}s before attempting cart completion...`
  )

  await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

  // Re-check: did the order get created during the delay?
  const orderAfterDelay = await findOrderByIntentId(paymentIntentId, logger)
  if (orderAfterDelay) {
    logger.info(
      `[Airwallex Webhook] Safety net: order ${orderAfterDelay.id} was created during delay — no action needed`
    )
    return
  }

  logger.info(
    `[Airwallex Webhook] Safety net: still no order after ${DELAY_MS / 1000}s delay. Searching for cart...`
  )

  try {
    const query = scope.resolve(ContainerRegistrationKeys.QUERY)

    // Search recent uncompleted carts for one with this Airwallex intent ID
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "completed_at",
        "email",
        "shipping_address.*",
        "payment_collection.*",
        "payment_collection.payment_sessions.*",
      ],
      filters: {},
      pagination: { order: { created_at: "DESC" }, skip: 0, take: 80 },
    })

    let targetCart: any = null
    for (const cart of carts || []) {
      if (cart.completed_at) continue // skip already completed carts
      const sessions = cart.payment_collection?.payment_sessions || []
      for (const session of sessions) {
        if (
          session.data?.intentId === paymentIntentId ||
          session.data?.airwallexPaymentIntentId === paymentIntentId
        ) {
          targetCart = cart
          break
        }
      }
      if (targetCart) break
    }

    if (!targetCart) {
      logger.warn(
        `[Airwallex Webhook] Safety net: no uncompleted cart found for intent ${paymentIntentId}`
      )
      return
    }

    logger.info(
      `[Airwallex Webhook] Safety net: found uncompleted cart ${targetCart.id} (email: ${targetCart.email}) — attempting to complete`
    )

    // Final duplicate check right before completing: query order table one more time
    const orderFinalCheck = await findOrderByIntentId(paymentIntentId, logger)
    if (orderFinalCheck) {
      logger.info(
        `[Airwallex Webhook] Safety net: order ${orderFinalCheck.id} appeared just before completion — aborting (no duplicate)`
      )
      return
    }

    // Complete the cart via Medusa's cart completion workflow
    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result = await completeCartWorkflow(scope).run({
      input: { id: targetCart.id },
    })

    const completedOrder = (result as any)?.result?.order || (result as any)?.order
    if (completedOrder) {
      logger.info(
        `[Airwallex Webhook] Safety net: ✅ Cart ${targetCart.id} completed → order ${completedOrder.id} (display_id: ${completedOrder.display_id})`
      )

      // Update the new order's metadata with Airwallex payment info
      try {
        const { Pool } = require("pg")
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        const { rows: orderRows } = await pool.query(
          `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
          [completedOrder.id]
        )
        const existingMeta = orderRows[0]?.metadata || {}
        const updatedMeta = {
          ...existingMeta,
          airwallexPaymentIntentId: paymentIntentId,
          airwallexStatus: "payment_intent.succeeded",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          payment_airwallex_intent_id: paymentIntentId,
          payment_method: intentData.latest_payment_attempt?.payment_method?.type || intentData.payment_method_type || "card",
          completed_by: "airwallex_webhook_safety_net",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMeta), completedOrder.id]
        )
        await pool.end()
        logger.info(
          `[Airwallex Webhook] Safety net: updated order ${completedOrder.id} metadata with Airwallex payment data`
        )
      } catch (metaErr: any) {
        logger.warn(
          `[Airwallex Webhook] Safety net: failed to update order metadata: ${metaErr.message}`
        )
      }

      // Emit payment.captured event so subscribers (Fakturoid, Dextrum, etc.) can react
      try {
        const eventBus = scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit("payment.captured", { id: completedOrder.id })
        logger.info(
          `[Airwallex Webhook] Safety net: emitted payment.captured for order ${completedOrder.id}`
        )
      } catch (e: any) {
        logger.warn(
          `[Airwallex Webhook] Safety net: failed to emit payment.captured: ${e.message}`
        )
      }
    } else {
      logger.warn(
        `[Airwallex Webhook] Safety net: cart completion returned unexpected result: ${JSON.stringify(result).slice(0, 500)}`
      )
    }
  } catch (safetyErr: any) {
    logger.error(
      `[Airwallex Webhook] Safety net failed for intent ${paymentIntentId}: ${safetyErr.message}`
    )
  }
}

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
    const order = await findOrderByIntentId(paymentIntentId, logger)

    if (!order) {
      logger.warn(
        `[Airwallex Webhook] No order found for payment intent: ${paymentIntentId}`
      )

      // ─── SAFETY NET: Auto-complete cart when payment succeeded but order doesn't exist ───
      // This handles redirect methods (Bancontact, iDEAL, EPS, BLIK, etc.) where
      // the customer pays at the bank but never returns to the checkout page.
      if (event_type === "payment_intent.succeeded") {
        // Fire and forget — don't block the webhook response (Airwallex expects fast 200)
        safetyNetCompleteCart(paymentIntentId, intentData, req.scope, logger).catch((err) => {
          logger.error(`[Airwallex Webhook] Safety net unhandled error: ${err.message}`)
        })
      }

      emitPaymentLog(logger, {
        provider: "airwallex",
        event: event_type,
        transaction_id: paymentIntentId,
        status: "pending",
        payment_method: intentData.latest_payment_attempt?.payment_method?.type || "unknown",
        metadata: { order_not_found: true },
      })

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
