// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { logPaymentEvent } from "../../../modules/payment-debug/utils/log"
import { PayUApiClient, fromMinor } from "../../../modules/payment-payu/api-client"

const SAFETY_NET_NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"

/**
 * Fire-and-forget alert to ntfy when the safety net hits a state needing human attention.
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
        Title: Buffer.from(title, "utf-8").toString("base64"),
        "X-Title-Encoding": "base64",
        Priority: priority,
        Tags: "warning,payu,safety_net",
      },
      body: message,
    })
  } catch {
    // ignore
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

/**
 * Find order by PayU orderId OR extOrderId in metadata, or via linked payment_session.
 */
async function findOrderByPayUIds(payuOrderId: string, extOrderId: string | null, logger: any): Promise<any> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // 1) Fast path: payuOrderId in metadata
    const direct = await pool.query(
      `SELECT id, metadata FROM "order"
       WHERE metadata->>'payu_order_id' = $1
          OR metadata->>'payuOrderId' = $1
       LIMIT 1`,
      [payuOrderId]
    )
    if (direct.rows[0]) return direct.rows[0]

    // 2) Match via extOrderId
    if (extOrderId) {
      const byExt = await pool.query(
        `SELECT id, metadata FROM "order"
         WHERE metadata->>'payu_ext_order_id' = $1
            OR metadata->>'extOrderId' = $1
         LIMIT 1`,
        [extOrderId]
      )
      if (byExt.rows[0]) return byExt.rows[0]
    }

    // 3) Fallback: payment_session.data contains payuOrderId
    const linked = await pool.query(
      `SELECT o.id, o.metadata
       FROM "order" o
       JOIN order_payment_collection opc ON opc.order_id = o.id
       JOIN payment_collection pc ON pc.id = opc.payment_collection_id
       JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE ps.data::text LIKE '%' || $1 || '%'
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [payuOrderId]
    )
    return linked.rows[0] || null
  } catch (dbErr: any) {
    logger.warn(`[PayU Webhook] DB query failed: ${dbErr.message}`)
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * Load PayU `second_key` (MD5 webhook signing key) by merchantPosId from gateway_config.
 * Scans both top-level live_keys.webhook_secret and metadata.pos_by_currency.*.second_key.
 */
async function findSecondKeyForPosId(posId: string, logger: any): Promise<string | null> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows } = await pool.query(
      `SELECT id, display_name, mode, live_keys, test_keys, metadata
       FROM gateway_config
       WHERE provider = 'payu' AND is_active = true AND deleted_at IS NULL`
    )
    for (const r of rows) {
      const keys = (r.mode === "live" ? r.live_keys : r.test_keys) || {}
      let meta = r.metadata || {}
      if (typeof meta === "string") {
        try { meta = JSON.parse(meta) } catch { meta = {} }
      }

      // Top-level POS
      if (keys.api_key && String(keys.api_key) === String(posId)) {
        return String(keys.webhook_secret || "")
      }
      // Per-currency POSes
      const pbc = meta.pos_by_currency || {}
      for (const cur of Object.keys(pbc)) {
        const slot = pbc[cur] || {}
        if (String(slot.pos_id) === String(posId)) {
          return String(slot.second_key || keys.webhook_secret || "")
        }
      }
    }
    return null
  } catch (e: any) {
    logger.warn(`[PayU Webhook] gateway_config lookup failed: ${e.message}`)
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * Safety net: auto-complete cart when PayU notifies COMPLETED but no order exists.
 * Same shape as Airwallex safety net. PayU redirect-based methods (BLIK, PBL banks,
 * GooglePay/ApplePay on hosted page) all need this.
 */
async function safetyNetCompleteCart(
  payuOrderId: string,
  extOrderId: string | null,
  orderPayload: any,
  scope: any,
  logger: any
): Promise<void> {
  const DELAY_MS = 30_000
  logger.info(
    `[PayU Webhook] Safety net: no order found for payuOrderId=${payuOrderId} (ext=${extOrderId}). Waiting ${DELAY_MS / 1000}s...`
  )
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

  const afterDelay = await findOrderByPayUIds(payuOrderId, extOrderId, logger)
  if (afterDelay) {
    logger.info(`[PayU Webhook] Safety net: order ${afterDelay.id} appeared during delay — no action`)
    return
  }

  let cartRow: any = null
  try {
    const { Pool } = require("pg")
    const cartPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    try {
      // Search payment_session.data for payuOrderId OR extOrderId
      const searchValues = [payuOrderId]
      if (extOrderId) searchValues.push(extOrderId)
      // Build OR-WHERE dynamically
      const orClauses = searchValues
        .map((_, i) => `ps.data::text LIKE '%' || $${i + 1} || '%'`)
        .join(" OR ")
      const { rows } = await cartPool.query(
        `SELECT c.id, c.email
         FROM cart c
         JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
         JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
         JOIN payment_session ps ON ps.payment_collection_id = pc.id
         WHERE (${orClauses})
           AND c.completed_at IS NULL
         ORDER BY c.created_at DESC
         LIMIT 1`,
        searchValues
      )
      cartRow = rows[0] || null
    } finally {
      await cartPool.end().catch(() => {})
    }

    if (!cartRow) {
      logger.warn(`[PayU Webhook] Safety net: no uncompleted cart for payuOrderId=${payuOrderId}`)
      logPaymentEvent({
        intent_id: payuOrderId,
        event_type: "payu_safety_net_no_cart",
        event_data: { ext_order_id: extOrderId },
        error_code: "no_cart",
      }).catch(() => {})
      alertSafetyNet(
        "PayU safety-net: cart not found",
        `payuOrderId ${payuOrderId} (ext=${extOrderId}) COMPLETED but no uncompleted cart matches. Manual recovery needed.`
      )
      return
    }
    const targetCart = cartRow

    // Final dup check
    const finalCheck = await findOrderByPayUIds(payuOrderId, extOrderId, logger)
    if (finalCheck) {
      logger.info(`[PayU Webhook] Safety net: order ${finalCheck.id} appeared right before completion — abort (no duplicate)`)
      return
    }

    // Amount validation
    const cartTotals = await getCartLiveTotal(targetCart.id)
    const paidAmount = orderPayload?.totalAmount ? fromMinor(orderPayload.totalAmount) : 0
    if (cartTotals && paidAmount > 0) {
      if (Math.abs(cartTotals.total - paidAmount) > 0.02) {
        const msg =
          `payuOrderId ${payuOrderId} paid ${paidAmount} ${(orderPayload?.currencyCode || cartTotals.currency || "").toUpperCase()} ` +
          `but cart ${targetCart.id} total is ${cartTotals.total}. Manual recovery — completeCartWorkflow would reject.`
        logger.error(`[PayU Webhook] Safety net amount mismatch: ${msg}`)
        logPaymentEvent({
          intent_id: payuOrderId,
          cart_id: targetCart.id,
          email: targetCart.email,
          event_type: "payu_safety_net_amount_mismatch",
          event_data: { paid: paidAmount, cart_total: cartTotals.total, currency: orderPayload?.currencyCode },
          error_code: "amount_mismatch",
        }).catch(() => {})
        alertSafetyNet("PayU safety-net: amount mismatch", msg)
        return
      }
    }

    logPaymentEvent({
      intent_id: payuOrderId,
      cart_id: targetCart.id,
      email: targetCart.email,
      event_type: "payu_safety_net_completing",
      event_data: { paid: paidAmount, cart_total: cartTotals?.total ?? null },
    }).catch(() => {})

    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result = await completeCartWorkflow(scope).run({ input: { id: targetCart.id } })
    const r: any = result as any
    const completedOrderId = r?.result?.id || r?.result?.order?.id || r?.id || r?.order?.id || null

    if (completedOrderId) {
      logger.info(`[PayU Webhook] Safety net: ✅ Cart ${targetCart.id} → order ${completedOrderId}`)
      logPaymentEvent({
        intent_id: payuOrderId,
        cart_id: targetCart.id,
        email: targetCart.email,
        event_type: "payu_safety_net_completed",
        event_data: { order_id: completedOrderId, paid: paidAmount },
      }).catch(() => {})

      // Update order metadata with PayU info
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
          payu_order_id: payuOrderId,
          payu_ext_order_id: extOrderId,
          payu_status: "COMPLETED",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          payment_method: orderPayload?.payMethod?.value || existingMeta.payment_method || "payu",
          payment_provider: "payu",
          completed_by: "payu_webhook_safety_net",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMeta), completedOrderId]
        )
        await pool.end()
      } catch (metaErr: any) {
        logger.warn(`[PayU Webhook] Safety net metadata update failed: ${metaErr.message}`)
      }

      // Emit payment.captured
      try {
        const eventBus = scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: completedOrderId } })
        logger.info(`[PayU Webhook] Emitted payment.captured for order ${completedOrderId}`)
      } catch (e: any) {
        logger.warn(`[PayU Webhook] Failed to emit payment.captured: ${e.message}`)
      }
    } else {
      const msg = `Safety net: unexpected completeCartWorkflow result for cart ${targetCart.id} / payuOrderId ${payuOrderId}: ${JSON.stringify(result).slice(0, 300)}`
      logger.warn(`[PayU Webhook] ${msg}`)
      logPaymentEvent({
        intent_id: payuOrderId,
        cart_id: targetCart.id,
        email: targetCart.email,
        event_type: "payu_safety_net_unexpected_result",
        event_data: { result_keys: Object.keys((result as any) || {}) },
        error_code: "unexpected_result",
      }).catch(() => {})
      alertSafetyNet("PayU safety-net: unexpected result", msg)
    }
  } catch (safetyErr: any) {
    const msg = `PayU safety net failed for payuOrderId ${payuOrderId}: ${safetyErr?.message || safetyErr}`
    logger.error(`[PayU Webhook] ${msg}`)
    logPaymentEvent({
      intent_id: payuOrderId,
      cart_id: cartRow?.id ?? null,
      email: cartRow?.email ?? null,
      event_type: "payu_safety_net_failed",
      event_data: { message: safetyErr?.message || String(safetyErr), stack: (safetyErr?.stack || "").slice(0, 1000) },
      error_code: "safety_net_exception",
    }).catch(() => {})
    alertSafetyNet("PayU safety-net: threw", msg)
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  try {
    // PayU IPN signature is computed over raw body. Try multiple shapes Medusa might pass.
    const rawBody: string =
      (req as any).rawBody?.toString?.() ||
      (req as any).rawBody ||
      (typeof req.body === "string" ? req.body : JSON.stringify(req.body || {}))

    const sigHeader =
      (req.headers["openpayu-signature"] as string) ||
      (req.headers["OpenPayu-Signature"] as string) ||
      ""

    // Parse body
    let parsed: any
    try {
      parsed = typeof req.body === "object" && req.body !== null ? req.body : JSON.parse(rawBody)
    } catch {
      logger.warn("[PayU Webhook] Could not parse body as JSON")
      return res.status(200).json({ received: true })
    }

    const order = parsed?.order || {}
    const payuOrderId: string = order?.orderId
    const extOrderId: string | null = order?.extOrderId || null
    const status: string = (order?.status || "").toUpperCase()
    const posId: string = order?.merchantPosId

    if (!payuOrderId) {
      logger.warn("[PayU Webhook] No order.orderId in payload — ignoring")
      return res.status(200).json({ received: true })
    }

    // ── Signature verification ──
    // Lookup secondKey by posId from gateway_config
    let signatureOk = false
    if (posId) {
      const secondKey = await findSecondKeyForPosId(posId, logger)
      if (secondKey) {
        signatureOk = PayUApiClient.verifyIpnSignature(rawBody, sigHeader, secondKey)
      } else {
        logger.warn(`[PayU Webhook] No second_key configured for POS ${posId} — refusing to process`)
      }
    } else {
      logger.warn("[PayU Webhook] No merchantPosId in order payload — cannot verify signature")
    }

    if (!signatureOk) {
      logger.warn(`[PayU Webhook] Signature verification FAILED for orderId=${payuOrderId}, pos=${posId}`)
      logPaymentEvent({
        intent_id: payuOrderId,
        event_type: "payu_webhook_signature_fail",
        event_data: { pos_id: posId, ext_order_id: extOrderId, has_signature_header: !!sigHeader },
        error_code: "signature_fail",
      }).catch(() => {})
      // Return 200 so PayU stops retrying; do not act on unverified payloads
      return res.status(200).json({ received: true, signature: "rejected" })
    }

    logger.info(
      `[PayU Webhook] Received: payuOrderId=${payuOrderId}, ext=${extOrderId}, status=${status}, pos=${posId}`
    )

    logPaymentEvent({
      intent_id: payuOrderId,
      event_type: "payu_webhook_received",
      event_data: {
        ext_order_id: extOrderId,
        status,
        pos_id: posId,
        amount: order?.totalAmount || null,
        currency: order?.currencyCode || null,
        pay_method: order?.payMethod?.value || null,
      },
    }).catch(() => {})

    // Find existing order
    const orderRow = await findOrderByPayUIds(payuOrderId, extOrderId, logger)

    if (!orderRow) {
      // Safety net only on terminal-success status
      if (status === "COMPLETED") {
        safetyNetCompleteCart(payuOrderId, extOrderId, order, req.scope, logger).catch((err) => {
          logger.error(`[PayU Webhook] Safety net unhandled: ${err.message}`)
        })
      }
      return res.status(200).json({ received: true })
    }

    // Update existing order's metadata with PayU activity entry
    const activityEntry: any = {
      timestamp: new Date().toISOString(),
      event: status === "COMPLETED" ? "capture" : status === "CANCELED" ? "cancel" : "status_update",
      gateway: "payu",
      payment_method: order?.payMethod?.value || "payu",
      status: status === "COMPLETED" ? "success" : status === "CANCELED" ? "failed" : "pending",
      amount: order?.totalAmount ? fromMinor(order.totalAmount) : null,
      currency: order?.currencyCode || null,
      transaction_id: payuOrderId,
      ext_order_id: extOrderId,
      provider_raw_status: status,
      detail: `PayU status: ${status}`,
    }

    const existingMeta = orderRow.metadata || {}
    const existingLog = existingMeta.payment_activity_log || []
    const updatedMeta: any = {
      ...existingMeta,
      payment_activity_log: [...existingLog, activityEntry],
      payu_order_id: payuOrderId,
      payu_ext_order_id: extOrderId,
      payu_status: status,
    }
    if (status === "COMPLETED") {
      updatedMeta.payment_captured = true
      updatedMeta.payment_captured_at = new Date().toISOString()
    }

    try {
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      await pool.query(
        `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(updatedMeta), orderRow.id]
      )
      await pool.end()
    } catch (dbErr: any) {
      logger.warn(`[PayU Webhook] DB update failed: ${dbErr.message}`)
    }

    if (status === "COMPLETED") {
      try {
        const eventBus = req.scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: orderRow.id } })
        logger.info(`[PayU Webhook] Emitted payment.captured for order ${orderRow.id}`)
      } catch (e: any) {
        logger.warn(`[PayU Webhook] Failed to emit payment.captured: ${e.message}`)
      }
    }

    return res.status(200).json({ received: true })
  } catch (error: any) {
    logger.error(`[PayU Webhook] Error: ${error.message}`)
    // Always 200 — PayU retries on non-2xx
    return res.status(200).json({ error: error.message })
  }
}

// PayU sometimes does a GET as a "ping" health check on the notifyUrl
export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  return res.status(200).json({ ok: true, provider: "payu" })
}
