// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { logPaymentEvent } from "../../../modules/payment-debug/utils/log"
import { BarionApiClient } from "../../../modules/payment-barion/api-client"
import { findCartForPaidIntent, recoverPaidCart } from "../../../modules/payment-airwallex/utils/recover-paid-cart"
import { sendOpsAlert } from "../../../utils/ops-alert"

/**
 * Barion callback (IPN). Barion POSTs only a PaymentId — there is NO signature,
 * so we NEVER trust the callback body: we always re-read the real state via
 * GetPaymentState with our POSKey (pull, not push). Idempotent — Barion retries.
 *
 * Redirect-based (hosted Smart Gateway) → same safety-net as Airwallex: if the
 * payment Succeeded but no order exists (customer didn't return), find the
 * uncompleted cart and complete it.
 */

/** Find the project slug tied to this PaymentId (session data or order metadata). */
async function findProjectSlug(paymentId: string): Promise<string | null> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const sess = await pool.query(
      `SELECT ps.data FROM payment_session ps
       WHERE ps.data::text LIKE '%' || $1 || '%'
       ORDER BY ps.created_at DESC LIMIT 1`,
      [paymentId]
    )
    const slug = sess.rows[0]?.data?.project_slug
    if (slug) return slug
    const ord = await pool.query(
      `SELECT metadata->>'project_id' AS slug FROM "order"
       WHERE metadata->>'barionPaymentId' = $1 LIMIT 1`,
      [paymentId]
    )
    return ord.rows[0]?.slug || null
  } catch {
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

/** Build a Barion client from gateway_config, matched by project slug. */
async function buildBarionClient(projectSlug: string | null): Promise<BarionApiClient | null> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys, project_slugs, priority
       FROM gateway_config
       WHERE provider = 'barion' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    if (!rows.length) return null
    let config: any = null
    if (projectSlug) {
      config = rows.find((r: any) => Array.isArray(r.project_slugs) && r.project_slugs.includes(projectSlug))
    }
    if (!config) config = rows.find((r: any) => !r.project_slugs?.length) || rows[0]
    const isLive = config.mode === "live"
    const keys = isLive ? config.live_keys : config.test_keys
    const posKey = keys?.pos_key || keys?.api_key
    const payee = keys?.payee || keys?.secret_key
    if (!posKey || !payee) return null
    return new BarionApiClient(posKey, payee, !isLive, console)
  } catch {
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

/** Find an order already linked to this PaymentId. */
async function findOrderByPaymentId(paymentId: string, logger: any): Promise<any> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const direct = await pool.query(
      `SELECT id, metadata FROM "order" WHERE metadata->>'barionPaymentId' = $1 LIMIT 1`,
      [paymentId]
    )
    if (direct.rows[0]) return direct.rows[0]
    const linked = await pool.query(
      `SELECT o.id, o.metadata FROM "order" o
       JOIN order_payment_collection opc ON opc.order_id = o.id
       JOIN payment_collection pc ON pc.id = opc.payment_collection_id
       JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE ps.data::text LIKE '%' || $1 || '%'
       ORDER BY o.created_at DESC LIMIT 1`,
      [paymentId]
    )
    return linked.rows[0] || null
  } catch (e: any) {
    logger.warn(`[Barion Webhook] order lookup failed: ${e.message}`)
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

async function safetyNetCompleteCart(paymentId: string, state: any, scope: any, logger: any): Promise<void> {
  const DELAY_MS = 30_000
  logger.info(`[Barion Webhook] Safety net: no order for ${paymentId}, waiting ${DELAY_MS / 1000}s...`)
  await new Promise((r) => setTimeout(r, DELAY_MS))

  const orderAfter = await findOrderByPaymentId(paymentId, logger)
  if (orderAfter) {
    logger.info(`[Barion Webhook] Safety net: order ${orderAfter.id} appeared during delay — done`)
    return
  }

  let cartRef: any = null
  try {
    const { Pool } = require("pg")
    const cartPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    try {
      cartRef = await findCartForPaidIntent(cartPool, paymentId, {
        sessionId: null,
        returnUrl: state?.RedirectUrl || null,
      })
    } finally {
      await cartPool.end().catch(() => {})
    }
  } catch (e: any) {
    logger.error(`[Barion Webhook] Safety net cart lookup failed: ${e.message}`)
  }

  if (!cartRef) {
    logPaymentEvent({ intent_id: paymentId, event_type: "safety_net_no_cart", event_data: { reason: "no_uncompleted_cart_found", provider: "barion" }, error_code: "no_cart" }).catch(() => {})
    sendOpsAlert(
      "Safety-net (Barion): cart not found",
      `Barion payment ${paymentId} Succeeded but no uncompleted cart matches. The orphan sweeper will retry; if this repeats, manual recovery is needed.`
    ).catch(() => {})
    return
  }

  const paidAmount = Number(state?.Total || 0)
  const result = await recoverPaidCart(scope, logger, {
    cartId: cartRef.id,
    intentId: paymentId,
    paidAmount,
    paymentMethod: state?.FundingSource || "barion",
    source: "barion_webhook_safety_net",
  })

  if (result.ok) {
    logger.info(`[Barion Webhook] Safety net: ✅ cart ${cartRef.id} → order ${result.orderId}`)
    return
  }
  if (result.reason === "order_exists" || result.reason === "cart_completed") return
  sendOpsAlert("Safety-net (Barion): completion failed", `Barion ${paymentId} (cart ${cartRef.id}): ${result.reason} — ${result.detail || ""}. Orphan sweeper will retry.`).catch(() => {})
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  try {
    const logger = req.scope.resolve("logger")
    // Barion sends the PaymentId either as a query param or a form/JSON field.
    const paymentId =
      (req.query?.paymentId as string) || (req.query?.PaymentId as string) ||
      (req.body as any)?.PaymentId || (req.body as any)?.paymentId

    if (!paymentId) {
      logger.warn("[Barion Webhook] callback without PaymentId")
      return res.status(200).json({ received: true })
    }

    logger.info(`[Barion Webhook] callback for PaymentId ${paymentId}`)

    // ALWAYS verify by pulling the real state (callback is unsigned).
    const projectSlug = await findProjectSlug(paymentId)
    const client = await buildBarionClient(projectSlug)
    if (!client) {
      logger.error(`[Barion Webhook] no gateway_config to verify ${paymentId}`)
      return res.status(200).json({ received: true })
    }

    let state: any
    try {
      state = await client.getPaymentState(paymentId)
    } catch (e: any) {
      logger.error(`[Barion Webhook] GetPaymentState failed for ${paymentId}: ${e.message}`)
      return res.status(200).json({ received: true })
    }

    logPaymentEvent({
      intent_id: paymentId,
      project_slug: projectSlug,
      event_type: "barion_webhook_received",
      event_data: { status: state?.Status, amount: state?.Total, currency: state?.Currency, funding_source: state?.FundingSource || null },
    }).catch(() => {})

    const succeeded = state?.Status === "Succeeded" || state?.Status === "PartiallySucceeded"

    const order = await findOrderByPaymentId(paymentId, logger)

    if (!order) {
      if (succeeded) {
        safetyNetCompleteCart(paymentId, state, req.scope, logger).catch((err) =>
          logger.error(`[Barion Webhook] safety net error: ${err.message}`)
        )
      } else {
        logger.info(`[Barion Webhook] ${paymentId} status ${state?.Status} — no order yet, not paid, ignoring`)
      }
      return res.status(200).json({ received: true })
    }

    // Order exists — enrich metadata + mark captured on success.
    const existingMeta = order.metadata || {}
    const activityEntry = {
      timestamp: new Date().toISOString(),
      event: succeeded ? "capture" : "status_update",
      gateway: "barion",
      payment_method: state?.FundingSource || "barion",
      status: succeeded ? "success" : (state?.Status === "Failed" || state?.Status === "Expired" ? "failed" : "pending"),
      amount: state?.Total,
      currency: state?.Currency,
      transaction_id: paymentId,
      provider_raw_status: state?.Status,
      detail: `Barion status: ${state?.Status}`,
    }
    const updatedMetadata: any = {
      ...existingMeta,
      payment_activity_log: [...(existingMeta.payment_activity_log || []), activityEntry],
      barionPaymentId: paymentId,
      barionStatus: state?.Status,
    }
    if (succeeded) {
      updatedMetadata.payment_captured = true
      updatedMetadata.payment_captured_at = new Date().toISOString()
    }
    try {
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      await pool.query(`UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`, [JSON.stringify(updatedMetadata), order.id])
      await pool.end()
    } catch (e: any) {
      logger.warn(`[Barion Webhook] metadata update failed: ${e.message}`)
    }

    if (succeeded) {
      try {
        const eventBus = req.scope.resolve(Modules.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: order.id } })
        logger.info(`[Barion Webhook] emitted payment.captured for order ${order.id}`)
      } catch (e: any) {
        logger.warn(`[Barion Webhook] emit failed: ${e.message}`)
      }
    }

    return res.status(200).json({ received: true })
  } catch (error: any) {
    const logger = req.scope.resolve("logger")
    logger.error(`[Barion Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}
