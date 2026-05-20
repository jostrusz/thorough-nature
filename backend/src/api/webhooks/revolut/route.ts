// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { RevolutApiClient } from "../../../modules/payment-revolut/api-client"
import { logPaymentEvent } from "../../../modules/payment-debug/utils/log"

const SAFETY_NET_NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"

/**
 * Revolut Pay by Bank webhook handler.
 *
 * Revolut webhook payload: { event, order_id, merchant_order_ext_ref? }
 * Events: ORDER_COMPLETED, ORDER_AUTHORISED, ORDER_CANCELLED, ORDER_PAYMENT_FAILED
 *
 * Implements the same safety-net pattern as the Airwallex webhook: Pay by Bank
 * is redirect-based (customer leaves the page for their banking app), so if the
 * customer never returns, ORDER_COMPLETED triggers automatic cart completion.
 */

/** Fire-and-forget ntfy alert when the safety net needs human attention. */
async function alertSafetyNet(title: string, message: string): Promise<void> {
  try {
    await fetch(SAFETY_NET_NTFY_URL, {
      method: "POST",
      headers: {
        Title: Buffer.from(title, "utf-8").toString("base64"),
        "X-Title-Encoding": "base64",
        Priority: "high",
        Tags: "warning,revolut,safety_net",
      },
      body: message,
    })
  } catch {
    // alerting must never break the webhook flow
  }
}

/** Read live cart total + currency for amount validation. */
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
    return {
      total: Number(rows[0].items_total || 0) + Number(rows[0].shipping_total || 0),
      currency: rows[0].currency || "",
    }
  } catch {
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

/** Find an order by Revolut order id (metadata fast path → payment_session fallback). */
async function findOrderByRevolutOrderId(revolutOrderId: string, logger: any): Promise<any> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const direct = await pool.query(
      `SELECT id, metadata FROM "order"
       WHERE metadata->>'revolutOrderId' = $1
       LIMIT 1`,
      [revolutOrderId]
    )
    if (direct.rows[0]) return direct.rows[0]

    const linked = await pool.query(
      `SELECT o.id, o.metadata
       FROM "order" o
       JOIN order_payment_collection opc ON opc.order_id = o.id
       JOIN payment_collection pc ON pc.id = opc.payment_collection_id
       JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE ps.data::text LIKE '%' || $1 || '%'
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [revolutOrderId]
    )
    return linked.rows[0] || null
  } catch (dbErr: any) {
    logger.warn(`[Revolut Webhook] DB query failed: ${dbErr.message}`)
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * Resolve the Revolut order amount + signing secrets from gateway_config.
 * Returns { secrets } always; { client } only if a usable secret key exists.
 */
async function getRevolutGateways(): Promise<{
  secrets: string[]
  clients: RevolutApiClient[]
}> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  const secrets: string[] = []
  const clients: RevolutApiClient[] = []
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys FROM gateway_config
       WHERE provider = 'revolut' AND is_active = true AND deleted_at IS NULL`
    )
    for (const r of rows) {
      const isLive = r.mode === "live"
      const keys = isLive ? r.live_keys : r.test_keys
      if (keys?.webhook_secret) secrets.push(keys.webhook_secret)
      const secretKey = keys?.secret_key || keys?.api_key
      if (secretKey) clients.push(new RevolutApiClient(secretKey, !isLive))
    }
  } catch {
    // ignore — caller handles empty results
  } finally {
    await pool.end().catch(() => {})
  }
  return { secrets, clients }
}

/** Fetch the Revolut order amount, trying each configured gateway. */
async function fetchRevolutOrderAmount(
  revolutOrderId: string,
  clients: RevolutApiClient[]
): Promise<{ amount: number; currency: string } | null> {
  for (const client of clients) {
    try {
      const order = await client.getOrder(revolutOrderId)
      if (order?.id) return { amount: order.amount, currency: order.currency }
    } catch {
      // try the next gateway
    }
  }
  return null
}

/**
 * Safety net: auto-complete the cart when Revolut reports ORDER_COMPLETED
 * but no Medusa order exists (customer never returned from their banking app).
 */
async function safetyNetCompleteCart(
  revolutOrderId: string,
  clients: RevolutApiClient[],
  scope: any,
  logger: any
): Promise<void> {
  const DELAY_MS = 30_000

  logger.info(
    `[Revolut Webhook] Safety net: no order for ${revolutOrderId}. Waiting ${DELAY_MS / 1000}s before completing cart...`
  )
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

  const orderAfterDelay = await findOrderByRevolutOrderId(revolutOrderId, logger)
  if (orderAfterDelay) {
    logger.info(`[Revolut Webhook] Safety net: order ${orderAfterDelay.id} created during delay — no action needed`)
    return
  }

  let cartRow: any = null
  try {
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
        [revolutOrderId]
      )
      cartRow = rows[0] || null
    } finally {
      await cartPool.end().catch(() => {})
    }

    if (!cartRow) {
      logger.warn(`[Revolut Webhook] Safety net: no uncompleted cart for ${revolutOrderId}`)
      logPaymentEvent({
        intent_id: revolutOrderId,
        event_type: "safety_net_no_cart",
        event_data: { reason: "no_uncompleted_cart_found", provider: "revolut" },
        error_code: "no_cart",
      }).catch(() => {})
      alertSafetyNet(
        "Revolut safety-net: cart not found",
        `Revolut order ${revolutOrderId} completed but no uncompleted cart matches. Manual recovery needed.`
      )
      return
    }
    const targetCart = cartRow

    const orderFinalCheck = await findOrderByRevolutOrderId(revolutOrderId, logger)
    if (orderFinalCheck) {
      logger.info(`[Revolut Webhook] Safety net: order ${orderFinalCheck.id} appeared just before completion — aborting`)
      return
    }

    // ─── AMOUNT VALIDATION ───
    // completeCartWorkflow silently rejects when cart total ≠ paid amount.
    const cartTotals = await getCartLiveTotal(targetCart.id)
    const paid = await fetchRevolutOrderAmount(revolutOrderId, clients)
    if (cartTotals && paid && paid.amount > 0) {
      if (Math.abs(cartTotals.total - paid.amount) > 0.02) {
        const msg =
          `Revolut order ${revolutOrderId} paid ${paid.amount} ${paid.currency} ` +
          `but cart ${targetCart.id} (${targetCart.email}) total is ${cartTotals.total}. Manual recovery required.`
        logger.error(`[Revolut Webhook] Safety net amount mismatch: ${msg}`)
        logPaymentEvent({
          intent_id: revolutOrderId,
          cart_id: targetCart.id,
          email: targetCart.email,
          event_type: "safety_net_amount_mismatch",
          event_data: { paid: paid.amount, cart_total: cartTotals.total, currency: paid.currency, provider: "revolut" },
          error_code: "amount_mismatch",
        }).catch(() => {})
        alertSafetyNet("Revolut safety-net: amount mismatch", msg)
        return
      }
    }

    logPaymentEvent({
      intent_id: revolutOrderId,
      cart_id: targetCart.id,
      email: targetCart.email,
      event_type: "safety_net_completing",
      event_data: { provider: "revolut", paid: paid?.amount ?? null, cart_total: cartTotals?.total ?? null },
    }).catch(() => {})

    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result: any = await completeCartWorkflow(scope).run({ input: { id: targetCart.id } })
    const completedOrderId =
      result?.result?.id || result?.result?.order?.id || result?.id || result?.order?.id || null

    if (completedOrderId) {
      logger.info(`[Revolut Webhook] Safety net: ✅ Cart ${targetCart.id} completed → order ${completedOrderId}`)
      logPaymentEvent({
        intent_id: revolutOrderId,
        cart_id: targetCart.id,
        email: targetCart.email,
        event_type: "safety_net_completed",
        event_data: { order_id: completedOrderId, provider: "revolut" },
      }).catch(() => {})

      // Enrich the new order's metadata with Revolut payment info
      try {
        const { Pool } = require("pg")
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        const { rows: orderRows } = await pool.query(
          `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
          [completedOrderId]
        )
        const updatedMeta = {
          ...(orderRows[0]?.metadata || {}),
          revolutOrderId,
          payment_provider: "revolut",
          payment_method: "pay_by_bank",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          completed_by: "revolut_webhook_safety_net",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMeta), completedOrderId]
        )
        await pool.end()
      } catch (metaErr: any) {
        logger.warn(`[Revolut Webhook] Safety net: failed to update order metadata: ${metaErr.message}`)
      }

      // Emit payment.captured so subscribers (Fakturoid, Dextrum, etc.) react
      try {
        const eventBus = scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: completedOrderId } })
      } catch (e: any) {
        logger.warn(`[Revolut Webhook] Safety net: failed to emit payment.captured: ${e.message}`)
      }
    } else {
      const msg = `Revolut safety net: completeCartWorkflow returned unexpected result for cart ${targetCart.id} / order ${revolutOrderId}`
      logger.warn(`[Revolut Webhook] ${msg}`)
      alertSafetyNet("Revolut safety-net: unexpected result", msg)
    }
  } catch (safetyErr: any) {
    const msg = `Revolut safety net failed for order ${revolutOrderId} (cart ${cartRow?.id ?? "?"}): ${safetyErr?.message || safetyErr}`
    logger.error(`[Revolut Webhook] ${msg}`)
    logPaymentEvent({
      intent_id: revolutOrderId,
      cart_id: cartRow?.id ?? null,
      email: cartRow?.email ?? null,
      event_type: "safety_net_failed",
      event_data: { provider: "revolut", message: safetyErr?.message || String(safetyErr) },
      error_code: "safety_net_exception",
    }).catch(() => {})
    alertSafetyNet("Revolut safety-net: completion threw", msg)
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  try {
    const payload = req.body || {}
    const event: string = payload.event
    const revolutOrderId: string = payload.order_id

    if (!event || !revolutOrderId) {
      return res.status(400).json({ error: "Missing required Revolut webhook fields" })
    }

    const { secrets, clients } = await getRevolutGateways()

    // ─── Signature verification (best-effort) ───
    // Requires the raw request body. If it isn't available (no raw-body
    // middleware), we proceed and rely on the order/cart lookup below — an
    // attacker would still need a valid Revolut order id to do anything.
    const rawBody: string | undefined =
      (req as any).rawBody?.toString?.("utf-8") ?? (req as any).rawBody
    const signatureHeader = req.headers["revolut-signature"] as string | undefined
    const timestampHeader = req.headers["revolut-request-timestamp"] as string | undefined

    if (rawBody && signatureHeader && timestampHeader && secrets.length > 0) {
      if (!RevolutApiClient.isTimestampFresh(timestampHeader)) {
        logger.warn(`[Revolut Webhook] Rejected — timestamp outside tolerance zone`)
        return res.status(403).json({ error: "Timestamp outside the tolerance zone" })
      }
      const valid = secrets.some((secret) =>
        RevolutApiClient.verifyWebhookSignature({
          rawBody,
          signatureHeader,
          timestampHeader,
          signingSecret: secret,
        })
      )
      if (!valid) {
        logger.warn(`[Revolut Webhook] Rejected — invalid signature for order ${revolutOrderId}`)
        return res.status(403).json({ error: "Invalid signature" })
      }
    } else {
      logger.warn(
        `[Revolut Webhook] Signature NOT verified (rawBody=${!!rawBody}, header=${!!signatureHeader}, secrets=${secrets.length}) — relying on order lookup`
      )
    }

    logger.info(`[Revolut Webhook] Received event: ${event}, order: ${revolutOrderId}`)

    // Journey log
    logPaymentEvent({
      intent_id: revolutOrderId,
      event_type: "revolut_webhook_received",
      event_data: { revolut_event: event },
    }).catch(() => {})

    const order = await findOrderByRevolutOrderId(revolutOrderId, logger)

    if (!order) {
      logger.warn(`[Revolut Webhook] No order found for Revolut order: ${revolutOrderId}`)
      // ─── SAFETY NET — Pay by Bank is redirect-based ───
      if (event === "ORDER_COMPLETED") {
        safetyNetCompleteCart(revolutOrderId, clients, req.scope, logger).catch((err) => {
          logger.error(`[Revolut Webhook] Safety net unhandled error: ${err.message}`)
        })
      }
      return res.status(200).json({ received: true })
    }

    // Order exists — update metadata + activity log
    const isFailed = event === "ORDER_CANCELLED" || event === "ORDER_PAYMENT_FAILED"
    const activityEntry: any = {
      timestamp: new Date().toISOString(),
      event: event === "ORDER_COMPLETED" ? "capture" : event === "ORDER_AUTHORISED" ? "authorization" : "status_update",
      gateway: "revolut",
      payment_method: "pay_by_bank",
      status: event === "ORDER_COMPLETED" ? "success" : isFailed ? "failed" : "pending",
      transaction_id: revolutOrderId,
      webhook_event_type: event,
      detail: `Revolut event: ${event}`,
    }

    const existingMeta = order.metadata || {}
    const updatedMetadata: any = {
      ...existingMeta,
      payment_activity_log: [...(existingMeta.payment_activity_log || []), activityEntry],
      revolutOrderId,
      revolutStatus: event,
    }
    if (event === "ORDER_COMPLETED") {
      updatedMetadata.payment_captured = true
      updatedMetadata.payment_captured_at = new Date().toISOString()
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
      logger.warn(`[Revolut Webhook] DB update failed: ${dbErr.message}`)
    }

    logger.info(`[Revolut Webhook] Order ${order.id} updated with event: ${event}`)

    if (event === "ORDER_COMPLETED") {
      try {
        const eventBus = req.scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: order.id } })
        logger.info(`[Revolut Webhook] Emitted payment.captured for order ${order.id}`)
      } catch (e: any) {
        logger.warn(`[Revolut Webhook] Failed to emit payment.captured: ${e.message}`)
      }
    }

    return res.status(200).json({ received: true })
  } catch (error: any) {
    logger.error(`[Revolut Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}
