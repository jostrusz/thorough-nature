// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { emitPaymentLog } from "../../../utils/payment-logger"
import { logPaymentEvent } from "../../../modules/payment-debug/utils/log"
import { findCartForPaidIntent, recoverPaidCart } from "../../../modules/payment-airwallex/utils/recover-paid-cart"
import { sendOpsAlert } from "../../../utils/ops-alert"

/**
 * Alert when the safety net hits a state that needs human attention
 * (cart not found, amount mismatch, completion error). Fire-and-forget,
 * never throws — goes to ntfy AND ops email (see utils/ops-alert).
 */
async function alertSafetyNet(
  title: string,
  message: string,
  priority: "default" | "high" = "high"
): Promise<void> {
  await sendOpsAlert(title, message, priority)
}

/**
 * Helper: find order by Airwallex payment intent ID via direct DB query
 */
async function findOrderByIntentId(paymentIntentId: string, logger: any): Promise<any> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // 1) Fast path: order metadata already enriched with intent ID (set by previous webhook)
    const direct = await pool.query(
      `SELECT id, metadata FROM "order"
       WHERE metadata->>'airwallexPaymentIntentId' = $1
       LIMIT 1`,
      [paymentIntentId]
    )
    if (direct.rows[0]) return direct.rows[0]

    // 2) Fallback: order linked to a payment_session whose data contains this intent ID.
    // Required because metadata->>'airwallexPaymentIntentId' is set only AFTER the first
    // successful webhook lookup — without this fallback the very first webhook for a new
    // order returns null and the safety net runs unnecessarily.
    const linked = await pool.query(
      `SELECT o.id, o.metadata
       FROM "order" o
       JOIN order_payment_collection opc ON opc.order_id = o.id
       JOIN payment_collection pc ON pc.id = opc.payment_collection_id
       JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE ps.data::text LIKE '%' || $1 || '%'
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [paymentIntentId]
    )
    return linked.rows[0] || null
  } catch (dbErr: any) {
    logger.warn(`[Airwallex Webhook] DB query failed: ${dbErr.message}`)
    return null
  } finally {
    await pool.end().catch(() => {})
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

  // ─── FIND THE CART ───
  // Three strategies (see findCartForPaidIntent): session.data contains the
  // intent id (normal case), intent metadata.session_id → payment_session.id,
  // and cart_id parsed from the intent's return_url. The latter two survive
  // retry churn, where a re-submit overwrote the session with a NEWER unpaid
  // intent while the customer paid this (older) one at the bank.
  let cartRef: any = null
  try {
    const { Pool } = require("pg")
    const cartPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    try {
      cartRef = await findCartForPaidIntent(cartPool, paymentIntentId, {
        sessionId: intentData?.metadata?.session_id || null,
        returnUrl: intentData?.return_url || null,
      })
    } finally {
      await cartPool.end().catch(() => {})
    }
  } catch (lookupErr: any) {
    logger.error(`[Airwallex Webhook] Safety net: cart lookup failed: ${lookupErr.message}`)
  }

  if (!cartRef) {
    logger.warn(
      `[Airwallex Webhook] Safety net: no uncompleted cart found for intent ${paymentIntentId}`
    )
    logPaymentEvent({
      intent_id: paymentIntentId,
      event_type: "safety_net_no_cart",
      event_data: { reason: "no_uncompleted_cart_found" },
      error_code: "no_cart",
    }).catch(() => {})
    alertSafetyNet(
      "Safety-net: cart not found",
      `Intent ${paymentIntentId} succeeded but no uncompleted cart matches (session, metadata.session_id, return_url all dead ends). The orphan sweeper will retry; if this repeats, manual recovery is needed.`
    )
    return
  }

  logger.info(
    `[Airwallex Webhook] Safety net: found uncompleted cart ${cartRef.id} (email: ${cartRef.email}, matched by ${cartRef.matched_by}) — attempting to complete`
  )

  const paidAmount = Number(intentData?.amount || 0)
  const paymentMethod =
    intentData.latest_payment_attempt?.payment_method?.type || intentData.payment_method_type || "card"

  const result = await recoverPaidCart(scope, logger, {
    cartId: cartRef.id,
    intentId: paymentIntentId,
    paidAmount,
    paymentMethod,
    source: "airwallex_webhook_safety_net",
  })

  if (result.ok) {
    logger.info(
      `[Airwallex Webhook] Safety net: ✅ Cart ${cartRef.id} completed → order ${result.orderId}`
    )
    return
  }

  switch (result.reason) {
    case "order_exists":
      logger.info(
        `[Airwallex Webhook] Safety net: order ${result.orderId} already exists for intent ${paymentIntentId} — no action needed`
      )
      return
    case "cart_completed":
      logger.info(
        `[Airwallex Webhook] Safety net: cart ${cartRef.id} was completed in the meantime — no action needed`
      )
      return
    case "amount_mismatch": {
      const msg =
        `Intent ${paymentIntentId} paid ${paidAmount} ${(intentData?.currency || "").toUpperCase()} ` +
        `but cart ${cartRef.id} (${cartRef.email}) doesn't match: ${result.detail}. ` +
        `Manual recovery required — completeCartWorkflow would reject.`
      logger.error(`[Airwallex Webhook] Safety net amount mismatch: ${msg}`)
      alertSafetyNet("Safety-net: amount mismatch", msg)
      return
    }
    default: {
      const msg = `Safety net failed for intent ${paymentIntentId} (cart ${cartRef.id}): ${result.reason} — ${result.detail || ""}. The orphan sweeper will retry.`
      logger.error(`[Airwallex Webhook] ${msg}`)
      alertSafetyNet("Safety-net: completion failed", msg)
      return
    }
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

    // Journey log — webhook event (async status update from Airwallex).
    // Captures final status + failure reasons for forensic debugging.
    logPaymentEvent({
      intent_id: paymentIntentId,
      event_type: "airwallex_webhook_received",
      event_data: {
        airwallex_event: event_type,
        status: intentData.status || null,
        amount: intentData.amount || null,
        currency: intentData.currency || null,
        payment_method_type: intentData?.latest_payment_attempt?.payment_method?.type
          || intentData?.payment_method?.type
          || null,
        failure_code: intentData?.latest_payment_attempt?.failure_code || null,
        failure_reason: intentData?.latest_payment_attempt?.failure_reason || null,
        captured_amount: intentData.captured_amount || null,
      },
      error_code: intentData?.latest_payment_attempt?.failure_code || null,
    }).catch(() => {})

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
        await eventBus.emit({ name: "payment.captured", data: { id: order.id } })
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
