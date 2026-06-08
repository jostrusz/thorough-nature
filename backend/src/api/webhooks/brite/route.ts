// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { emitPaymentLog } from "../../../utils/payment-logger"
import { logPaymentEvent } from "../../../modules/payment-debug/utils/log"
import { BriteApiClient } from "../../../modules/payment-brite/api-client"

const SAFETY_NET_NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"

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
        "Tags": "warning,brite,safety_net",
      },
      body: message,
    })
  } catch {
    // alerting must never break webhook flow
  }
}

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

async function findOrderByBriteIds(keys: string[], logger: any): Promise<any> {
  const uniq = [...new Set((keys || []).filter(Boolean).map(String))]
  if (!uniq.length) return null
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // Fast path: metadata already enriched (session id or merchant_reference)
    const direct = await pool.query(
      `SELECT id, metadata FROM "order"
       WHERE metadata->>'briteSessionId' = ANY($1)
          OR metadata->>'brite_session_id' = ANY($1)
          OR metadata->>'payment_brite_session_id' = ANY($1)
          OR metadata->>'brite_merchant_reference' = ANY($1)
       LIMIT 1`,
      [uniq]
    )
    if (direct.rows[0]) return direct.rows[0]

    // Fallback: any key (session id / transaction id / merchant_reference) appears
    // in payment_session.data — covers callbacks that send a different id than we stored.
    const linked = await pool.query(
      `SELECT o.id, o.metadata
       FROM "order" o
       JOIN order_payment_collection opc ON opc.order_id = o.id
       JOIN payment_collection pc ON pc.id = opc.payment_collection_id
       JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE EXISTS (SELECT 1 FROM unnest($1::text[]) k WHERE ps.data::text LIKE '%' || k || '%')
       ORDER BY o.created_at DESC
       LIMIT 1`,
      [uniq]
    )
    return linked.rows[0] || null
  } catch (dbErr: any) {
    logger.warn(`[Brite Webhook] DB query failed: ${dbErr.message}`)
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * Resolve every id we can match a cart/order on from a callback that may carry
 * only one id (Brite sends the transaction id, but we store the session id).
 * Pulls the cross-id + merchant_reference from the payload, and — if the
 * merchant_reference isn't in the payload — asks Brite (session.get / transaction.get).
 * Never throws; always returns at least the original id.
 */
async function getBriteCredentials(): Promise<{ clientId: string; clientSecret: string; isTest: boolean; baseUrl?: string } | null> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys, metadata
       FROM gateway_config
       WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    if (!rows[0]) return null
    const isTest = rows[0].mode !== "live"
    const k = isTest ? rows[0].test_keys : rows[0].live_keys
    if (!k?.api_key || !k?.secret_key) return null
    return { clientId: k.api_key, clientSecret: k.secret_key, isTest, baseUrl: rows[0].metadata?.base_url || undefined }
  } catch {
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

/**
 * Brite ids are base64-encoded datastore keys whose decoded bytes contain the entity
 * name ("…Transaction…" / "…Session…"). Detect the kind so we hit the RIGHT endpoint
 * and never trigger a 400 (e.g. transaction.get with a Session id), which would
 * otherwise pollute Brite's logs (flagged in the Brite integration review).
 */
function briteIdKind(id: string): "transaction" | "session" | null {
  try {
    const decoded = Buffer.from(String(id), "base64").toString("latin1")
    if (decoded.includes("Transaction")) return "transaction"
    if (decoded.includes("Session")) return "session"
  } catch {
    /* not decodable — fall through */
  }
  return null
}

async function resolveBriteMatchKeys(callbackId: string, txData: any, logger: any): Promise<string[]> {
  const keys = new Set<string>([String(callbackId)])
  if (txData?.merchant_reference) keys.add(String(txData.merchant_reference))
  if (txData?.session_id) keys.add(String(txData.session_id))
  if (txData?.transaction_id) keys.add(String(txData.transaction_id))

  // If the payload already gave us a merchant_reference we don't need an API round-trip.
  if (txData?.merchant_reference) return [...keys].filter(Boolean)

  const creds = await getBriteCredentials()
  if (!creds) return [...keys].filter(Boolean)
  const client = new BriteApiClient(creds.clientId, creds.clientSecret, creds.isTest, logger, creds.baseUrl)

  async function viaSession() {
    const s = await client.getSession(callbackId)
    if (s?.id) keys.add(String(s.id))
    if (s?.transaction_id) keys.add(String(s.transaction_id))
    if (s?.merchant_reference) keys.add(String(s.merchant_reference))
  }
  async function viaTransaction() {
    const tx = await client.getTransaction(callbackId)
    if (tx?.session_id) keys.add(String(tx.session_id))
    if (tx?.id) keys.add(String(tx.id))
    if (tx?.merchant_reference) keys.add(String(tx.merchant_reference))
  }

  // Route by id type so we call the correct endpoint directly (no 400s).
  const kind = briteIdKind(callbackId)
  try {
    if (kind === "session") await viaSession()
    else if (kind === "transaction") await viaTransaction()
    else { try { await viaSession() } catch { await viaTransaction() } } // unknown → session first
  } catch (e: any) {
    logger.warn(`[Brite Webhook] resolveBriteMatchKeys: could not resolve ${callbackId} (kind=${kind}): ${e?.message}`)
  }
  return [...keys].filter(Boolean)
}

/**
 * Safety net for the redirect open-banking flow: customer paid at the bank
 * but never returned to the storefront (closed browser, lost mobile flow,
 * etc.). Identical pattern to webhooks/airwallex/route.ts.
 */
async function safetyNetCompleteCart(
  matchKeys: string[],
  txData: any,
  scope: any,
  logger: any
): Promise<void> {
  const DELAY_MS = 30_000
  const briteSessionId = matchKeys[0]

  logger.info(
    `[Brite Webhook] Safety net: no order for ${briteSessionId}. Waiting ${DELAY_MS / 1000}s before completing cart...`
  )
  await new Promise((resolve) => setTimeout(resolve, DELAY_MS))

  const orderAfterDelay = await findOrderByBriteIds(matchKeys, logger)
  if (orderAfterDelay) {
    logger.info(`[Brite Webhook] Safety net: order ${orderAfterDelay.id} appeared during delay`)
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
         WHERE EXISTS (SELECT 1 FROM unnest($1::text[]) k WHERE ps.data::text LIKE '%' || k || '%')
           AND c.completed_at IS NULL
         ORDER BY c.created_at DESC
         LIMIT 1`,
        [matchKeys]
      )
      cartRow = rows[0] || null
    } finally {
      await cartPool.end().catch(() => {})
    }

    if (!cartRow) {
      logger.warn(`[Brite Webhook] Safety net: no uncompleted cart for ${briteSessionId}`)
      logPaymentEvent({
        intent_id: briteSessionId,
        event_type: "safety_net_no_cart",
        event_data: { provider: "brite" },
        error_code: "no_cart",
      }).catch(() => {})
      alertSafetyNet(
        "Brite safety-net: cart not found",
        `Session ${briteSessionId} completed but no uncompleted cart matches.`
      )
      return
    }
    const targetCart = cartRow

    // Final duplicate check
    const orderFinalCheck = await findOrderByBriteIds(matchKeys, logger)
    if (orderFinalCheck) {
      logger.info(`[Brite Webhook] Safety net: order ${orderFinalCheck.id} appeared just before completion`)
      return
    }

    // Amount validation
    const cartTotals = await getCartLiveTotal(targetCart.id)
    const paidAmount = Number(txData?.amount || 0)
    if (cartTotals && paidAmount > 0) {
      if (Math.abs(cartTotals.total - paidAmount) > 0.02) {
        const msg =
          `Brite session ${briteSessionId} paid ${paidAmount} ${(txData?.currency || cartTotals.currency || "").toUpperCase()} ` +
          `but cart ${targetCart.id} (${targetCart.email}) total is ${cartTotals.total}. Manual recovery required.`
        logger.error(`[Brite Webhook] Safety net amount mismatch: ${msg}`)
        logPaymentEvent({
          intent_id: briteSessionId,
          cart_id: targetCart.id,
          email: targetCart.email,
          event_type: "safety_net_amount_mismatch",
          event_data: { paid: paidAmount, cart_total: cartTotals.total, provider: "brite" },
          error_code: "amount_mismatch",
        }).catch(() => {})
        alertSafetyNet("Brite safety-net: amount mismatch", msg)
        return
      }
    }

    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result = await completeCartWorkflow(scope).run({
      input: { id: targetCart.id },
    })

    const r: any = result
    const completedOrderId =
      r?.result?.id || r?.result?.order?.id || r?.id || r?.order?.id || null

    if (completedOrderId) {
      logger.info(`[Brite Webhook] Safety net: ✅ cart ${targetCart.id} → order ${completedOrderId}`)
      logPaymentEvent({
        intent_id: briteSessionId,
        cart_id: targetCart.id,
        email: targetCart.email,
        event_type: "safety_net_completed",
        event_data: { order_id: completedOrderId, paid: paidAmount, provider: "brite" },
      }).catch(() => {})

      // Patch order metadata with Brite identifiers
      try {
        const { Pool } = require("pg")
        const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
        const { rows: orderRows } = await pool.query(
          `SELECT metadata FROM "order" WHERE id = $1 LIMIT 1`,
          [completedOrderId]
        )
        // JSONB MERGE (||) — never full-replace: a full replace races with the
        // order-placed subscribers and wipes their fields (custom_display_id, etc.).
        const mergeMeta = {
          briteSessionId,
          brite_session_id: briteSessionId,
          briteStatus: txData?.state || txData?.status || "COMPLETED",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          payment_provider: "brite",
          payment_method: "pay_by_bank",
          payment_brite_bank_id: txData?.bank?.id || null,
          payment_brite_bank_name: txData?.bank?.name || null,
          completed_by: "brite_webhook_safety_net",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(mergeMeta), completedOrderId]
        )
        await pool.end()
      } catch (metaErr: any) {
        logger.warn(`[Brite Webhook] Safety net: metadata update failed: ${metaErr.message}`)
      }

      try {
        const eventBus = scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: completedOrderId } })
      } catch (e: any) {
        logger.warn(`[Brite Webhook] Safety net: failed to emit payment.captured: ${e.message}`)
      }
    } else {
      const msg = `Brite safety net: completeCartWorkflow unexpected result for cart ${targetCart.id} / session ${briteSessionId}`
      logger.warn(`[Brite Webhook] ${msg}`)
      alertSafetyNet("Brite safety-net: unexpected result", msg)
    }
  } catch (safetyErr: any) {
    const msg = `Brite safety net failed for ${briteSessionId} (cart ${cartRow?.id ?? "?"}): ${safetyErr?.message || safetyErr}`
    logger.error(`[Brite Webhook] ${msg}`)
    alertSafetyNet("Brite safety-net: completion threw", msg)
  }
}

/**
 * Look up the webhook secret from gateway_config (DB).
 * Stored under live_keys.webhook_secret / test_keys.webhook_secret.
 */
async function getWebhookSecret(): Promise<string | null> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys
       FROM gateway_config
       WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    if (!rows[0]) return null
    const keys = rows[0].mode === "live" ? rows[0].live_keys : rows[0].test_keys
    return keys?.webhook_secret || null
  } catch {
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const logger = req.scope.resolve("logger")
  try {
    // ── Callback authentication ──
    // Brite does NOT sign callbacks (no HMAC, verified against docs). Instead we
    // authenticate by a secret token embedded in the callback URL at session
    // creation: ?cb_token=<gateway webhook_secret>. Only Brite calls back with it
    // because only we registered the URL. If a webhook_secret is configured, the
    // token must match; if not (sandbox bootstrap), we accept unverified.
    const webhookSecret = await getWebhookSecret()
    if (webhookSecret) {
      const cbToken = String((req.query?.cb_token as string) || "")
      if (cbToken !== webhookSecret) {
        logger.warn(`[Brite Webhook] cb_token mismatch (present: ${!!cbToken}) — dropping`)
        // Return 200 to avoid Brite retry storms; log + drop instead.
        return res.status(200).json({ received: true, ignored: "cb_token_mismatch" })
      }
    } else {
      logger.warn(`[Brite Webhook] No webhook_secret configured — accepting unverified callback (sandbox bootstrap)`)
    }

    const event_type =
      req.body?.event || req.body?.type || req.body?.name || "unknown"
    const txData =
      req.body?.data?.transaction ||
      req.body?.transaction ||
      req.body?.data ||
      req.body

    const briteSessionId =
      txData?.id || txData?.transaction_id || txData?.session_id

    if (!briteSessionId) {
      logger.warn(`[Brite Webhook] No transaction id in payload`)
      return res.status(200).json({ received: true })
    }

    // Brite uses NUMERIC states (not strings).
    //   transaction_state: 0 CREATED 1 PENDING 2 ABORTED 3 FAILED
    //                      4 COMPLETED 5 CREDIT 6 SETTLED 7 DEBIT
    //   session_state:     10 ABORTED 11 FAILED 12 COMPLETED
    // We accept the numeric state from the callback payload (any of these field names),
    // and keep a string fallback in case a payload sends a textual status.
    const txState = req.body?.transaction_state ?? txData?.transaction_state ?? txData?.state_id ?? null
    const sessState = req.body?.session_state ?? txData?.session_state ?? null
    const numState = (txState !== null ? Number(txState) : (sessState !== null ? Number(sessState) : NaN))
    const strState = String(txData?.state || txData?.status || "").toUpperCase()

    // Success = transaction 4/5/6 (completed/credit/settled) OR session 12 (completed)
    const isSuccess =
      [4, 5, 6].includes(numState) ||
      (sessState !== null && Number(sessState) === 12) ||
      ["COMPLETED", "SETTLED", "SUCCEEDED"].includes(strState)
    // Failure = transaction 2/3/7 (aborted/failed/debit) OR session 10/11
    const isFailed =
      [2, 3, 7].includes(numState) ||
      (sessState !== null && [10, 11].includes(Number(sessState))) ||
      ["FAILED", "DECLINED", "CANCELLED", "EXPIRED", "ABORTED"].includes(strState)

    const state = Number.isNaN(numState) ? strState : String(numState)

    logger.info(`[Brite Webhook] Event: ${event_type}, tx: ${briteSessionId}, state: ${state} (success=${isSuccess}, failed=${isFailed})`)

    logPaymentEvent({
      intent_id: briteSessionId,
      event_type: "brite_webhook_received",
      event_data: {
        brite_event: event_type,
        state,
        amount: txData?.amount ?? null,
        currency: txData?.currency ?? null,
        bank_id: txData?.bank?.id || null,
        bank_name: txData?.bank?.name || null,
        failure_reason: txData?.failure_reason || null,
      },
      error_code: isFailed ? (txData?.failure_reason || state || "failed") : null,
    }).catch(() => {})

    // Fast path: match the order with the ids already in the payload — NO Brite API
    // call in the common case (frontend already created the order). Only if not found
    // do we resolve via session.get/transaction.get (routed by id type, so no 400s).
    const payloadKeys = [String(briteSessionId), txData?.merchant_reference, txData?.session_id, txData?.transaction_id]
      .filter(Boolean).map(String)
    let matchKeys = payloadKeys
    let order = await findOrderByBriteIds(payloadKeys, logger)
    if (!order) {
      matchKeys = await resolveBriteMatchKeys(briteSessionId, txData, logger)
      order = await findOrderByBriteIds(matchKeys, logger)
    }

    if (!order) {
      logger.warn(`[Brite Webhook] No order for ${briteSessionId} (keys: ${matchKeys.length})`)

      if (isSuccess) {
        // Fire and forget — must not block 200 response
        safetyNetCompleteCart(matchKeys, txData, req.scope, logger).catch((err) => {
          logger.error(`[Brite Webhook] Safety net unhandled error: ${err.message}`)
        })
      }

      emitPaymentLog(logger, {
        provider: "brite",
        event: event_type,
        transaction_id: briteSessionId,
        status: "pending",
        payment_method: "pay_by_bank",
        metadata: { order_not_found: true, state },
      })

      return res.status(200).json({ received: true })
    }

    // Build activity log entry
    const activityEntry: any = {
      timestamp: new Date().toISOString(),
      event: isSuccess ? "capture" : isFailed ? "failure" : "status_update",
      gateway: "brite",
      payment_method: "pay_by_bank",
      status: isSuccess ? "success" : isFailed ? "failed" : "pending",
      amount: txData?.amount,
      currency: txData?.currency,
      transaction_id: briteSessionId,
      webhook_event_type: event_type,
      provider_raw_status: state,
      bank_id: txData?.bank?.id || null,
      bank_name: txData?.bank?.name || null,
      detail: `Brite event: ${event_type} (${state})`,
    }
    if (isFailed) {
      activityEntry.error_code = state
      activityEntry.decline_reason = txData?.failure_reason || "Payment failed"
    }

    const existingLog = (order.metadata as any)?.payment_activity_log || []
    // JSONB MERGE (||) — only the fields we add, NOT a full ...existingMeta replace.
    // A full replace clobbers the order-placed subscriber's payment_provider /
    // payment_method / bank fields (the webhook lands ~1 min after the order, after
    // the subscriber wrote them). Merge preserves them.
    const mergeMetadata: any = {
      payment_activity_log: [...existingLog, activityEntry],
      briteSessionId,
      brite_session_id: briteSessionId,
      briteStatus: state,
    }

    if (isSuccess) {
      mergeMetadata.payment_captured = true
      mergeMetadata.payment_captured_at = new Date().toISOString()
      mergeMetadata.payment_brite_session_id = briteSessionId
      if (txData?.bank?.id) mergeMetadata.payment_brite_bank_id = txData.bank.id
      if (txData?.bank?.name) mergeMetadata.payment_brite_bank_name = txData.bank.name
    }

    try {
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      await pool.query(
        `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(mergeMetadata), order.id]
      )
      await pool.end()
    } catch (dbErr: any) {
      logger.warn(`[Brite Webhook] DB update failed: ${dbErr.message}`)
    }

    if (isSuccess) {
      try {
        const eventBus = req.scope.resolve(ContainerRegistrationKeys.EVENT_BUS)
        await eventBus.emit({ name: "payment.captured", data: { id: order.id } })
        logger.info(`[Brite Webhook] Emitted payment.captured for order ${order.id}`)
      } catch (e: any) {
        logger.warn(`[Brite Webhook] Failed to emit payment.captured: ${e.message}`)
      }
    }

    emitPaymentLog(logger, {
      provider: "brite",
      event: event_type,
      order_id: order.id,
      transaction_id: briteSessionId,
      status: activityEntry.status,
      amount: txData?.amount,
      currency: (txData?.currency || "").toUpperCase(),
      payment_method: "pay_by_bank",
      error_code: activityEntry.error_code,
      decline_reason: activityEntry.decline_reason,
      provider_raw_status: state,
    })

    return res.status(200).json({ received: true })
  } catch (error: any) {
    logger.error(`[Brite Webhook] Error: ${error.message}`)
    return res.status(200).json({ error: error.message })
  }
}
