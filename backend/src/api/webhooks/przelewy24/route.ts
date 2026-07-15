// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Client, Pool } from "pg"
import {
  Przelewy24ApiClient,
  credsFromGatewayConfig,
  verifyNotificationSign,
} from "../../../modules/payment-przelewy24/api-client"
import { logPaymentEvent } from "../../../modules/payment-debug/utils/log"

/**
 * Przelewy24 status notification webhook (urlStatus).
 *
 * P24 POSTs a JSON notification ONLY for successful payments:
 *   { merchantId, posId, sessionId, amount, originAmount, currency,
 *     orderId, methodId, statement, sign }
 *
 * Flow:
 *   1. Verify `sign` (SHA-384 of the notification JSON + CRC)
 *   2. PUT /transaction/verify — MANDATORY, otherwise funds never settle
 *   3. Find the order by metadata.p24SessionId → update metadata + capture
 *   4. No order → SAFETY NET: wait 30s, re-check, complete the cart
 *      (customer paid but never returned from the bank — normal for
 *       redirect methods, not a bug)
 *
 * Response codes: 200 after successful verify (P24 stops retrying),
 * 400 on sign/verify failure so P24 retries (3/5/15/30/60/150/450 min).
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  let logger: any = console
  try { logger = req.scope.resolve("logger") || console } catch { /* console */ }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {}
    const { merchantId, sessionId, amount, currency, orderId, methodId } = body

    logPaymentEvent({
      intent_id: sessionId || null,
      event_type: "p24_webhook_received",
      event_data: {
        merchantId, orderId, methodId,
        amount, currency,
        statement: body?.statement ?? null,
      },
    })

    if (!sessionId || !orderId) {
      logger.warn("[Przelewy24 Webhook] Missing sessionId or orderId in notification")
      return res.status(400).json({ error: "Missing sessionId/orderId" })
    }

    logger.info(
      `[Przelewy24 Webhook] Notification: sessionId=${sessionId}, orderId=${orderId}, amount=${amount} ${currency}`
    )

    // ── Find matching gateway config by merchantId (multi-tenant) ──
    const configs = await loadP24Configs(logger)
    let matched: { creds: any; config: any } | null = null
    for (const config of configs) {
      const creds = credsFromGatewayConfig(config)
      if (!creds) continue
      if (Number(creds.merchantId) === Number(merchantId) && verifyNotificationSign(body, creds.crc)) {
        matched = { creds, config }
        break
      }
    }
    // Fallback: merchantId didn't match any row — try sign against all configs
    if (!matched) {
      for (const config of configs) {
        const creds = credsFromGatewayConfig(config)
        if (creds && verifyNotificationSign(body, creds.crc)) {
          matched = { creds, config }
          break
        }
      }
    }
    if (!matched) {
      logger.error(`[Przelewy24 Webhook] Invalid signature for sessionId ${sessionId} (merchantId=${merchantId})`)
      logPaymentEvent({
        intent_id: sessionId,
        event_type: "p24_webhook_received",
        event_data: { stage: "sign_invalid", merchantId },
        error_code: "invalid_sign",
      })
      return res.status(400).json({ error: "Invalid signature" })
    }

    // ── MANDATORY verify (PUT /transaction/verify) ──
    const client = new Przelewy24ApiClient(matched.creds)
    const amountMajor = Number(amount) / 100 // notification amount is in grosze
    const verify = await client.verifyTransaction({
      sessionId,
      orderId: Number(orderId),
      amount: amountMajor,
      currency: currency || "PLN",
    })

    if (!verify.success) {
      logger.error(`[Przelewy24 Webhook] Verify FAILED for sessionId ${sessionId}: ${verify.error}`)
      logPaymentEvent({
        intent_id: sessionId,
        event_type: "p24_webhook_received",
        event_data: { stage: "verify_failed", error: verify.error },
        error_code: "verify_failed",
      })
      // 400 → P24 retries the notification, giving us another verify attempt
      return res.status(400).json({ error: "Verification failed" })
    }

    logger.info(`[Przelewy24 Webhook] ✓ Transaction verified: sessionId=${sessionId}, orderId=${orderId}`)
    logPaymentEvent({
      intent_id: sessionId,
      event_type: "p24_webhook_received",
      event_data: { stage: "verified", orderId, amount: amountMajor, currency, methodId },
    })

    // ── Find order / safety net (best effort, must not affect the 200) ──
    try {
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      const order = await findOrderBySessionId(pool, sessionId)

      if (order) {
        await markOrderPaid(pool, order, body, logger)
        await captureOrderPayment(order.id, pool, req.scope, logger)
        await pool.end().catch(() => {})
      } else {
        logger.info(
          `[Przelewy24 Webhook] No order for sessionId ${sessionId} yet — scheduling safety net`
        )
        await pool.end().catch(() => {})
        // Don't await — respond 200 immediately, complete cart in background
        safetyNetCompleteCart(sessionId, body, req.scope, logger).catch((e) =>
          logger.warn(`[Przelewy24 Webhook] Safety net error: ${e.message}`)
        )
      }
    } catch (orderErr: any) {
      logger.warn(`[Przelewy24 Webhook] Order handling failed (non-critical): ${orderErr.message}`)
    }

    return res.status(200).send("OK")
  } catch (error: any) {
    logger.error(`[Przelewy24 Webhook] Error: ${error.message}`)
    // Unexpected error before verify — let P24 retry
    return res.status(400).json({ error: "Webhook processing failed" })
  }
}

/** Load all active P24 gateway configs (multi-tenant). */
async function loadP24Configs(logger: any): Promise<any[]> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return []
  let pgClient: Client | null = null
  try {
    pgClient = new Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes("railway") ? { rejectUnauthorized: false } : undefined,
    })
    await pgClient.connect()
    const result = await pgClient.query(
      `SELECT * FROM gateway_config
       WHERE provider = 'przelewy24' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    return result.rows
  } catch (e: any) {
    logger.warn(`[Przelewy24 Webhook] Config query failed: ${e.message}`)
    return []
  } finally {
    if (pgClient) { try { await pgClient.end() } catch {} }
  }
}

async function findOrderBySessionId(pool: any, sessionId: string): Promise<any | null> {
  const { rows } = await pool.query(
    `SELECT id, metadata FROM "order" WHERE metadata->>'p24SessionId' = $1 LIMIT 1`,
    [sessionId]
  )
  return rows[0] || null
}

async function markOrderPaid(pool: any, order: any, notification: any, logger: any): Promise<void> {
  try {
    const meta = typeof order.metadata === "string"
      ? JSON.parse(order.metadata)
      : order.metadata || {}
    const updated = {
      ...meta,
      p24SessionId: notification.sessionId,
      p24OrderId: notification.orderId,
      p24MethodId: notification.methodId,
      payment_provider: "przelewy24",
      payment_captured: true,
      payment_captured_at: new Date().toISOString(),
    }
    await pool.query(
      `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updated), order.id]
    )
    logger.info(`[Przelewy24 Webhook] Order ${order.id} marked paid (orderId=${notification.orderId})`)
  } catch (e: any) {
    logger.warn(`[Przelewy24 Webhook] Order metadata update failed: ${e.message}`)
  }
}

/**
 * Capture the order's Medusa payment (authorized → captured) and emit
 * payment.captured for downstream subscribers. Same as Comgate webhook.
 */
async function captureOrderPayment(orderId: string, pool: any, scope: any, logger: any): Promise<void> {
  try {
    const { Modules } = await import("@medusajs/framework/utils")
    const paymentModule = scope.resolve(Modules.PAYMENT) as any

    const { rows: pcRows } = await pool.query(
      `SELECT pc.id FROM payment_collection pc
       JOIN order_payment_collection opc ON opc.payment_collection_id = pc.id
       WHERE opc.order_id = $1 AND pc.status = 'authorized'
       LIMIT 1`,
      [orderId]
    )
    if (pcRows.length > 0) {
      const { rows: payRows } = await pool.query(
        `SELECT id FROM payment WHERE payment_collection_id = $1 LIMIT 1`,
        [pcRows[0].id]
      )
      if (payRows.length > 0) {
        await paymentModule.capturePayment({ payment_id: payRows[0].id })
        logger.info(`[Przelewy24 Webhook] Payment ${payRows[0].id} captured for order ${orderId}`)
      }
    }
  } catch (e: any) {
    logger.warn(`[Przelewy24 Webhook] Medusa capture failed for order ${orderId}: ${e.message}`)
  }

  try {
    const { ContainerRegistrationKeys: CRK } = await import("@medusajs/framework/utils")
    const eventBus = scope.resolve(CRK.EVENT_BUS)
    await eventBus.emit({ name: "payment.captured", data: { id: orderId } })
  } catch (e: any) {
    logger.warn(`[Przelewy24 Webhook] Failed to emit payment.captured: ${e.message}`)
  }
}

/**
 * Safety net: payment verified but no order exists (customer never returned
 * from the bank). Wait 30s for the normal return flow, re-check, then find
 * the uncompleted cart by payment_session.data and complete it.
 */
async function safetyNetCompleteCart(
  sessionId: string,
  notification: any,
  scope: any,
  logger: any
): Promise<void> {
  const DELAY_MS = 30_000
  logger.info(
    `[Przelewy24 Webhook] Safety net: waiting ${DELAY_MS / 1000}s before cart completion for ${sessionId}`
  )
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // Re-check: order created during the delay?
    const existing = await findOrderBySessionId(pool, sessionId)
    if (existing) {
      logger.info(`[Przelewy24 Webhook] Safety net: order ${existing.id} appeared during delay — capturing`)
      await markOrderPaid(pool, existing, notification, logger)
      await captureOrderPayment(existing.id, pool, scope, logger)
      return
    }

    // Find uncompleted cart via payment_session.data
    const { rows: cartRows } = await pool.query(
      `SELECT c.id, c.email
       FROM cart c
       JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
       JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
       JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE c.completed_at IS NULL
         AND (ps.data->>'p24SessionId' = $1 OR ps.data->>'sessionId' = $1)
       ORDER BY c.created_at DESC
       LIMIT 1`,
      [sessionId]
    )
    const targetCart = cartRows[0]
    if (!targetCart) {
      logger.warn(`[Przelewy24 Webhook] Safety net: no uncompleted cart for sessionId ${sessionId}`)
      logPaymentEvent({
        intent_id: sessionId,
        event_type: "p24_webhook_received",
        event_data: { stage: "safety_net_no_cart" },
        error_code: "safety_net_no_cart",
      })
      return
    }

    // Mark session verified so authorizePayment (inside completeCartWorkflow)
    // succeeds even if the P24 status read lags.
    try {
      await pool.query(
        `UPDATE payment_session
         SET data = data || jsonb_build_object(
           'p24_verified', true,
           'p24OrderId', $2::int,
           'p24MethodId', $3::int
         )
         WHERE (data->>'p24SessionId' = $1 OR data->>'sessionId' = $1)`,
        [sessionId, Number(notification.orderId), Number(notification.methodId) || null]
      )
    } catch (e: any) {
      logger.warn(`[Przelewy24 Webhook] Safety net: session flag update failed: ${e.message}`)
    }

    logger.info(
      `[Przelewy24 Webhook] Safety net: completing cart ${targetCart.id} (email: ${targetCart.email})`
    )

    // Final duplicate check
    const finalCheck = await findOrderBySessionId(pool, sessionId)
    if (finalCheck) {
      logger.info(`[Przelewy24 Webhook] Safety net: order ${finalCheck.id} appeared just before completion — aborting`)
      return
    }

    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result = await completeCartWorkflow(scope).run({ input: { id: targetCart.id } })
    const completedOrder = (result as any)?.result?.order || (result as any)?.order || (result as any)?.result

    if (completedOrder?.id) {
      logger.info(
        `[Przelewy24 Webhook] Safety net: ✅ Cart ${targetCart.id} completed → order ${completedOrder.id}`
      )
      try {
        const { rows: orderRows } = await pool.query(
          `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
          [completedOrder.id]
        )
        const existingMeta = orderRows[0]?.metadata || {}
        const updatedMeta = {
          ...existingMeta,
          p24SessionId: sessionId,
          p24OrderId: notification.orderId,
          p24MethodId: notification.methodId,
          payment_provider: "przelewy24",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          completed_by: "przelewy24_webhook_safety_net",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMeta), completedOrder.id]
        )
      } catch (metaErr: any) {
        logger.warn(`[Przelewy24 Webhook] Safety net: metadata update failed: ${metaErr.message}`)
      }
      await captureOrderPayment(completedOrder.id, pool, scope, logger)
      logPaymentEvent({
        intent_id: sessionId,
        cart_id: targetCart.id,
        email: targetCart.email,
        event_type: "p24_webhook_received",
        event_data: { stage: "safety_net_completed", order_id: completedOrder.id },
      })
    } else {
      logger.warn(`[Przelewy24 Webhook] Safety net: cart completion returned no order`)
    }
  } catch (err: any) {
    logger.error(`[Przelewy24 Webhook] Safety net failed: ${err.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}
