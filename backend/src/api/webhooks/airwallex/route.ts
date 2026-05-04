// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { emitPaymentLog } from "../../../utils/payment-logger"
import { logPaymentEvent } from "../../../modules/payment-debug/utils/log"

const SAFETY_NET_NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"

/**
 * Fire-and-forget alert to ntfy when the safety net hits a state that needs
 * human attention (amount mismatch, completion error, etc). Never throws.
 */
async function alertSafetyNet(
  title: string,
  message: string,
  priority: "default" | "high" = "high"
): Promise<void> {
  try {
    await fetch(SAFETY_NET_NTFY_URL, {
      method: "POST",
      headers: {
        "Title": Buffer.from(title, "utf-8").toString("base64"),
        "X-Title-Encoding": "base64",
        "Priority": priority,
        "Tags": "warning,airwallex,safety_net",
      },
      body: message,
    })
  } catch {
    // ignore — alerting must never break webhook flow
  }
}

/**
 * Helper: read live cart total + currency for amount validation.
 * Returns null if cart not found.
 */
async function getCartLiveTotal(cartId: string): Promise<{ total: number; currency: string } | null> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(quantity * unit_price)
                   FROM cart_line_item
                   WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS items_total,
         COALESCE((SELECT SUM(amount)
                   FROM cart_shipping_method
                   WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS shipping_total,
         (SELECT currency_code FROM cart WHERE id = $1) AS currency
       FROM (SELECT 1) AS dummy`,
      [cartId]
    )
    if (!rows[0]) return null
    const itemsTotal = Number(rows[0].items_total || 0)
    const shippingTotal = Number(rows[0].shipping_total || 0)
    return {
      total: itemsTotal + shippingTotal,
      currency: rows[0].currency || "",
    }
  } catch {
    return null
  } finally {
    await pool.end().catch(() => {})
  }
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

  let cartRow: any = null
  try {
    // Find the uncompleted cart via raw SQL on payment_session.data — reliable regardless
    // of cart volume and not dependent on graph-query JSONB serialization quirks.
    const { Pool } = require("pg")
    const cartPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    try {
      const { rows } = await cartPool.query(
        `SELECT c.id, c.email
         FROM cart c
         JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
         JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
         JOIN payment_session ps ON ps.payment_collection_id = pc.id
         WHERE ps.data::text LIKE '%' || $1 || '%'
           AND c.completed_at IS NULL
         ORDER BY c.created_at DESC
         LIMIT 1`,
        [paymentIntentId]
      )
      cartRow = rows[0] || null
    } finally {
      await cartPool.end().catch(() => {})
    }

    if (!cartRow) {
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
        `Intent ${paymentIntentId} succeeded but no uncompleted cart matches. Manual recovery needed.`
      )
      return
    }
    const targetCart = cartRow

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

    // ─── AMOUNT VALIDATION ───
    // completeCartWorkflow silently rejects when cart total doesn't match payment.
    // Validate up front so we can alert instead of fail silently.
    const cartTotals = await getCartLiveTotal(targetCart.id)
    const paidAmount = Number(intentData?.amount || 0)
    if (cartTotals && paidAmount > 0) {
      const cartTotal = cartTotals.total
      // Allow 1-cent tolerance for rounding
      if (Math.abs(cartTotal - paidAmount) > 0.02) {
        const msg =
          `Intent ${paymentIntentId} paid ${paidAmount} ${(intentData?.currency || cartTotals.currency || "").toUpperCase()} ` +
          `but cart ${targetCart.id} (${targetCart.email}) total is ${cartTotal}. ` +
          `Manual recovery required — completeCartWorkflow would reject.`
        logger.error(`[Airwallex Webhook] Safety net amount mismatch: ${msg}`)
        logPaymentEvent({
          intent_id: paymentIntentId,
          cart_id: targetCart.id,
          email: targetCart.email,
          event_type: "safety_net_amount_mismatch",
          event_data: { paid: paidAmount, cart_total: cartTotal, currency: intentData?.currency },
          error_code: "amount_mismatch",
        }).catch(() => {})
        alertSafetyNet("Safety-net: amount mismatch", msg)
        return
      }
    }

    logPaymentEvent({
      intent_id: paymentIntentId,
      cart_id: targetCart.id,
      email: targetCart.email,
      event_type: "safety_net_completing",
      event_data: { paid: paidAmount, cart_total: cartTotals?.total ?? null },
    }).catch(() => {})

    // Complete the cart via Medusa's cart completion workflow
    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result = await completeCartWorkflow(scope).run({
      input: { id: targetCart.id },
    })

    // Medusa v2's completeCartWorkflow returns { result: { id: orderId } } — not a nested
    // `order` object. Check every plausible shape so we don't false-negative when the order
    // was actually created (the previous shape-check was the cause of "unexpected result"
    // warnings + duplicate safety-net runs).
    const r: any = result as any
    const completedOrderId =
      r?.result?.id ||
      r?.result?.order?.id ||
      r?.id ||
      r?.order?.id ||
      null

    if (completedOrderId) {
      logger.info(
        `[Airwallex Webhook] Safety net: ✅ Cart ${targetCart.id} completed → order ${completedOrderId}`
      )
      logPaymentEvent({
        intent_id: paymentIntentId,
        cart_id: targetCart.id,
        email: targetCart.email,
        event_type: "safety_net_completed",
        event_data: { order_id: completedOrderId, paid: paidAmount },
      }).catch(() => {})

      // Update the new order's metadata with Airwallex payment info
      try {
        const { Pool } = require("pg")
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        const { rows: orderRows } = await pool.query(
          `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
          [completedOrderId]
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
          [JSON.stringify(updatedMeta), completedOrderId]
        )
        await pool.end()
        logger.info(
          `[Airwallex Webhook] Safety net: updated order ${completedOrderId} metadata with Airwallex payment data`
        )
      } catch (metaErr: any) {
        logger.warn(
          `[Airwallex Webhook] Safety net: failed to update order metadata: ${metaErr.message}`
        )
      }

      // Emit payment.captured event so subscribers (Fakturoid, Dextrum, etc.) can react
      try {
        const eventBus = scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: completedOrderId } })
        logger.info(
          `[Airwallex Webhook] Safety net: emitted payment.captured for order ${completedOrderId}`
        )
      } catch (e: any) {
        logger.warn(
          `[Airwallex Webhook] Safety net: failed to emit payment.captured: ${e.message}`
        )
      }
    } else {
      const msg = `Safety net: completeCartWorkflow returned unexpected result for cart ${targetCart.id} / intent ${paymentIntentId}: ${JSON.stringify(result).slice(0, 300)}`
      logger.warn(`[Airwallex Webhook] ${msg}`)
      logPaymentEvent({
        intent_id: paymentIntentId,
        cart_id: targetCart.id,
        email: targetCart.email,
        event_type: "safety_net_unexpected_result",
        event_data: { result_keys: Object.keys((result as any) || {}) },
        error_code: "unexpected_result",
      }).catch(() => {})
      alertSafetyNet("Safety-net: unexpected result", msg)
    }
  } catch (safetyErr: any) {
    const msg = `Safety net failed for intent ${paymentIntentId} (cart ${cartRow?.id ?? "?"}): ${safetyErr?.message || safetyErr}`
    logger.error(`[Airwallex Webhook] ${msg}`)
    logPaymentEvent({
      intent_id: paymentIntentId,
      cart_id: cartRow?.id ?? null,
      email: cartRow?.email ?? null,
      event_type: "safety_net_failed",
      event_data: {
        message: safetyErr?.message || String(safetyErr),
        stack: (safetyErr?.stack || "").slice(0, 1000),
      },
      error_code: "safety_net_exception",
    }).catch(() => {})
    alertSafetyNet("Safety-net: completion threw", msg)
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
