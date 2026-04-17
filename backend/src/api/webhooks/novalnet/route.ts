// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { emitPaymentLog } from "../../../utils/payment-logger"
import { buildNovalnetChecksum, verifyNovalnetChecksum } from "../../../modules/payment-novalnet/helpers/checksum"
import { mapWebhookEventToAction } from "../../../modules/payment-novalnet/helpers/status-map"

/**
 * Novalnet webhook (a.k.a. "notification") handler.
 *
 * Novalnet sends a JSON POST to our notification URL whenever a transaction
 * changes state. The payload includes:
 *   { event: { type, tid, checksum, ... }, transaction: {...}, result: {...} }
 *
 * SECURITY:
 *   The `event.checksum` field is verified using SHA-256 against our
 *   payment_access_key (per gateway_config). See helpers/checksum.ts.
 *
 * SAFETY NET:
 *   Like Airwallex/Stripe/PayPal/Klarna webhooks, redirect-based methods
 *   sometimes complete on Novalnet's side but the customer never returns
 *   to our return_url (browser closed, network drop, mobile context switch).
 *   For PAYMENT events without a corresponding order in our DB, we wait 30s
 *   then auto-complete the cart — preventing dropped orders.
 */

/** Find the order whose payment metadata stores this Novalnet TID. */
async function findOrderByTid(tid: string, logger: any): Promise<any> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // Fast path: order metadata already enriched with the TID
    const direct = await pool.query(
      `SELECT id, metadata FROM "order"
       WHERE metadata->>'novalnetTid' = $1
       LIMIT 1`,
      [tid]
    )
    if (direct.rows[0]) return direct.rows[0]

    // Fallback: order linked through payment_session.data.tid
    const linked = await pool.query(
      `SELECT o.id, o.metadata
       FROM "order" o
       JOIN order_payment_collection opc ON opc.order_id = o.id
       JOIN payment_collection pc ON pc.id = opc.payment_collection_id
       JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE ps.data::text LIKE '%' || $1 || '%'
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [tid]
    )
    return linked.rows[0] || null
  } catch (e: any) {
    logger.warn(`[Novalnet Webhook] DB query failed: ${e.message}`)
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * Safety net — for redirect-based methods where the customer pays at the
 * bank/PayPal page but never returns to our checkout. Mirrors Airwallex.
 */
async function safetyNetCompleteCart(tid: string, txData: any, scope: any, logger: any): Promise<void> {
  const DELAY_MS = 30_000
  logger.info(
    `[Novalnet Webhook] Safety net armed for tid=${tid}. Waiting ${DELAY_MS / 1000}s before attempting cart completion...`
  )
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

  // Re-check: did the order materialize during the delay?
  const orderAfter = await findOrderByTid(tid, logger)
  if (orderAfter) {
    logger.info(`[Novalnet Webhook] Safety net: order ${orderAfter.id} appeared during delay — no action.`)
    return
  }

  logger.info(`[Novalnet Webhook] Safety net: still no order. Searching for matching uncompleted cart...`)

  try {
    const { Pool } = require("pg")
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    let cartRow: any = null
    try {
      const { rows } = await pool.query(
        `SELECT c.id, c.email
         FROM cart c
         JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
         JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
         JOIN payment_session ps ON ps.payment_collection_id = pc.id
         WHERE ps.data::text LIKE '%' || $1 || '%'
           AND c.completed_at IS NULL
         ORDER BY c.created_at DESC
         LIMIT 1`,
        [tid]
      )
      cartRow = rows[0] || null
    } finally {
      await pool.end().catch(() => {})
    }

    if (!cartRow) {
      logger.warn(`[Novalnet Webhook] Safety net: no uncompleted cart found for tid=${tid}`)
      return
    }

    logger.info(`[Novalnet Webhook] Safety net: found uncompleted cart ${cartRow.id} (email: ${cartRow.email}) — attempting to complete`)

    // Final dup-check before completing
    const orderFinalCheck = await findOrderByTid(tid, logger)
    if (orderFinalCheck) {
      logger.info(`[Novalnet Webhook] Safety net: order ${orderFinalCheck.id} appeared just before completion — aborting.`)
      return
    }

    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result = await completeCartWorkflow(scope).run({
      input: { id: cartRow.id },
    })

    const r: any = result as any
    const completedOrderId =
      r?.result?.id ||
      r?.result?.order?.id ||
      r?.id ||
      r?.order?.id ||
      null

    if (completedOrderId) {
      logger.info(`[Novalnet Webhook] Safety net: ✅ Cart ${cartRow.id} completed → order ${completedOrderId}`)

      // Backfill order metadata with Novalnet payment info
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
          novalnetTid: tid,
          novalnetStatus: txData?.txStatus || txData?.status || "CONFIRMED",
          payment_provider: "novalnet",
          payment_method: txData?.payment_type || txData?.method || "novalnet",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          completed_by: "novalnet_webhook_safety_net",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMeta), completedOrderId]
        )
        await pool.end()
        logger.info(`[Novalnet Webhook] Safety net: backfilled order ${completedOrderId} metadata`)
      } catch (metaErr: any) {
        logger.warn(`[Novalnet Webhook] Safety net: failed to backfill metadata: ${metaErr.message}`)
      }

      // Emit payment.captured for downstream subscribers (Fakturoid, Dextrum, e-book email)
      try {
        const eventBus = scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: completedOrderId } })
        logger.info(`[Novalnet Webhook] Safety net: emitted payment.captured for order ${completedOrderId}`)
      } catch (e: any) {
        logger.warn(`[Novalnet Webhook] Safety net: failed to emit payment.captured: ${e.message}`)
      }
    } else {
      logger.warn(`[Novalnet Webhook] Safety net: cart completion returned unexpected result: ${JSON.stringify(result).slice(0, 500)}`)
    }
  } catch (safetyErr: any) {
    logger.error(`[Novalnet Webhook] Safety net failed for tid=${tid}: ${safetyErr.message}`)
  }
}

/** Resolve the payment_access_key from gateway_config to verify the checksum. */
async function getPaymentAccessKey(projectSlug: string | null): Promise<string | null> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys, project_slugs
       FROM gateway_config
       WHERE provider = 'novalnet' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    let config: any = null
    if (projectSlug) {
      config = rows.find((r: any) => {
        const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
        return slugs.includes(projectSlug)
      })
    }
    if (!config) {
      config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
    }
    if (!config) return null
    const keys = config.mode === "live" ? config.live_keys : config.test_keys
    return keys?.payment_access_key || null
  } catch {
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")

  try {
    const payload = req.body as any
    const evt = payload?.event || {}
    const tx = payload?.transaction || {}
    const result = payload?.result || {}

    const eventType = String(evt.type || "").toUpperCase()
    const tid = String(tx.tid || evt.tid || "")
    const txnSecret = tx.txn_secret || evt.txn_secret
    const projectSlug = payload?.custom?.project_slug || null
    const incomingChecksum = evt.checksum || payload?.checksum

    logger.info(`[Novalnet Webhook] Received event=${eventType}, tid=${tid}, status=${tx.status || result.status}`)

    if (!tid) {
      logger.warn(`[Novalnet Webhook] No TID in payload`)
      return res.status(200).json({ received: true })
    }

    // ─── 1. Verify checksum ───────────────────────────────────────────────
    // Novalnet sends `event.checksum = sha256(tid + txn_secret + status + reverse(payment_access_key))`
    // We compute the same and constant-time compare. If mismatch → reject.
    if (incomingChecksum) {
      const accessKey = await getPaymentAccessKey(projectSlug)
      if (!accessKey) {
        logger.warn(`[Novalnet Webhook] No payment_access_key configured — cannot verify checksum, processing anyway`)
      } else {
        const expected = buildNovalnetChecksum({
          tid,
          txnSecret: String(txnSecret || ""),
          status: tx.status || result.status || "",
          paymentAccessKey: accessKey,
        })
        if (!verifyNovalnetChecksum(expected, String(incomingChecksum))) {
          logger.error(`[Novalnet Webhook] ⚠️ Checksum mismatch for tid=${tid} — rejecting`)
          return res.status(401).json({ error: "Invalid checksum" })
        }
        logger.info(`[Novalnet Webhook] ✓ Checksum verified for tid=${tid}`)
      }
    } else {
      logger.warn(`[Novalnet Webhook] No checksum in payload — accepting (sandbox or unsigned mode)`)
    }

    // ─── 2. Find the order ────────────────────────────────────────────────
    const order = await findOrderByTid(tid, logger)

    if (!order) {
      logger.warn(`[Novalnet Webhook] No order found for tid=${tid}`)

      // SAFETY NET — fire and forget for PAYMENT-type events with success status
      const isSuccessfulPayment =
        eventType === "PAYMENT" ||
        eventType === "TRANSACTION_CONFIRMATION" ||
        eventType === "TRANSACTION_CAPTURE"

      if (isSuccessfulPayment) {
        safetyNetCompleteCart(tid, { ...tx, payment_type: tx.payment_type, txStatus: tx.status }, req.scope, logger).catch((err) => {
          logger.error(`[Novalnet Webhook] Safety net unhandled error: ${err.message}`)
        })
      }

      emitPaymentLog(logger, {
        provider: "novalnet",
        event: eventType,
        transaction_id: tid,
        status: "pending",
        payment_method: tx.payment_type || "unknown",
        metadata: { order_not_found: true },
      })

      return res.status(200).json({ received: true })
    }

    // ─── 3. Update order metadata ─────────────────────────────────────────
    const action = mapWebhookEventToAction(eventType, tx.status)
    const isFailed = action === "failed"

    const activityEntry: any = {
      timestamp: new Date().toISOString(),
      event: action === "captured" ? "capture" : action === "authorized" ? "authorization" : "status_update",
      gateway: "novalnet",
      payment_method: tx.payment_type || "unknown",
      status: action === "captured" ? "success" : isFailed ? "failed" : "pending",
      amount: tx.amount,
      currency: tx.currency,
      transaction_id: tid,
      webhook_event_type: eventType,
      provider_raw_status: tx.status,
      customer_email: order.metadata?.customer_email || null,
      detail: `Novalnet event: ${eventType}`,
    }

    const existingMeta = order.metadata || {}
    const existingLog = existingMeta.payment_activity_log || []
    const updatedMetadata: any = {
      ...existingMeta,
      payment_activity_log: [...existingLog, activityEntry],
      novalnetTid: tid,
      novalnetStatus: tx.status || eventType,
    }

    if (action === "captured") {
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
      logger.warn(`[Novalnet Webhook] DB update failed: ${dbErr.message}`)
    }

    logger.info(`[Novalnet Webhook] Order ${order.id} updated with event=${eventType}, action=${action}`)

    // Emit payment.captured for capture events (downstream subscribers)
    if (action === "captured") {
      try {
        const eventBus = req.scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: order.id } })
        logger.info(`[Novalnet Webhook] Emitted payment.captured for order ${order.id}`)
      } catch (e: any) {
        logger.warn(`[Novalnet Webhook] Failed to emit payment.captured: ${e.message}`)
      }
    }

    emitPaymentLog(logger, {
      provider: "novalnet",
      event: eventType,
      order_id: order.id,
      transaction_id: tid,
      status: activityEntry.status,
      amount: tx.amount,
      currency: (tx.currency || "").toUpperCase(),
      customer_email: activityEntry.customer_email,
      payment_method: activityEntry.payment_method,
      provider_raw_status: tx.status,
    })

    return res.status(200).json({ received: true })
  } catch (error: any) {
    logger.error(`[Novalnet Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}
