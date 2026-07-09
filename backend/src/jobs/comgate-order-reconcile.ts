// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { Client } from "pg"
import { ComgateApiClient } from "../modules/payment-comgate/api-client"
import { logPaymentEvent } from "../modules/payment-debug/utils/log"

/**
 * Comgate order reconciliation cron — durable poll-based backstop.
 *
 * Comgate's real-time path is the webhook (push notification → status check →
 * capture / safety-net cart completion). But the webhook only fires if the
 * notification URL is configured on the Comgate side, and it's a single
 * delivery — a missed push, a process restart inside the 30s safety-net window,
 * or an expired cart means the payment settles at Comgate while the order stays
 * PENDING forever and nobody re-checks.
 *
 * This matters most for DEFERRED methods (bank transfer / QR platba), where the
 * customer pays minutes/hours/days after leaving checkout: at return time the
 * transaction is still PENDING, so there's no order yet — only the webhook (or
 * this cron) can ever convert it.
 *
 * Every 15 min this job actively polls Comgate /status for every still-open
 * Comgate transaction and reconciles the ones that turned PAID:
 *   A) uncompleted cart  → completeCartWorkflow (amount-validated, dup-checked)
 *   B) order not captured → capturePayment
 * Both stamp metadata and emit payment.captured (→ e-book, Dextrum, invoice),
 * mirroring the webhook. Idempotent: re-checks for a race before acting, so it
 * can never double-create an order or double-capture.
 */

const NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"
const CART_LOOKBACK = "10 days"   // deferred bank transfers can settle over several days
const ORDER_LOOKBACK = "14 days"
const MAX_CANDIDATES = 100

async function alert(title: string, message: string): Promise<void> {
  try {
    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        Title: Buffer.from(title, "utf-8").toString("base64"),
        "X-Title-Encoding": "base64",
        Priority: "high",
        Tags: "warning,comgate,reconcile",
      },
      body: message,
    })
  } catch {
    /* ignore */
  }
}

function fromMinor(minor: any): number {
  const n = Number(minor)
  return isFinite(n) ? Math.round(n) / 100 : 0
}

async function cartLiveTotal(
  pool: any,
  cartId: string
): Promise<{ total: number; currency: string } | null> {
  const { rows } = await pool.query(
    `SELECT
       COALESCE((SELECT SUM(quantity * unit_price) FROM cart_line_item
                 WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS items_total,
       COALESCE((SELECT SUM(amount) FROM cart_shipping_method
                 WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS shipping_total,
       (SELECT currency_code FROM cart WHERE id = $1) AS currency`,
    [cartId]
  )
  if (!rows[0]) return null
  return {
    total: Number(rows[0].items_total || 0) + Number(rows[0].shipping_total || 0),
    currency: rows[0].currency || "",
  }
}

/**
 * Load active Comgate gateway config (mirror of webhook loadComgateConfig).
 * Returns { client, merchant, secret } ready to poll status, or null if
 * unavailable/misconfigured. NOTE: ComgateApiClient.getStatus reads merchant +
 * secret from its params (not the constructor), so we must carry the keys.
 */
async function loadComgateConfigs(
  logger: any
): Promise<Array<{ client: ComgateApiClient; merchant: string; secret: string; projectSlugs: string[] }>> {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) return []

  let pgClient: Client | null = null
  try {
    pgClient = new Client({
      connectionString: dbUrl,
      ssl: dbUrl.includes("railway") ? { rejectUnauthorized: false } : undefined,
    })
    await pgClient.connect()
    // Load ALL active Comgate gateways (multi-tenant: e.g. CZ merchant 509962 +
    // SK merchant 515357). A given transId belongs to exactly one merchant, so
    // getStatus is tried against each until the owning merchant answers.
    const { rows } = await pgClient.query(
      "SELECT * FROM gateway_config WHERE provider = $1 AND is_active = true AND deleted_at IS NULL ORDER BY priority ASC",
      ["comgate"]
    )
    const out: Array<{ client: ComgateApiClient; merchant: string; secret: string; projectSlugs: string[] }> = []
    for (const config of rows) {
      let keys = config.mode === "live" ? config.live_keys : config.test_keys
      if (typeof keys === "string") {
        try { keys = JSON.parse(keys) } catch { keys = null }
      }
      if (keys?.api_key && keys?.secret_key) {
        out.push({
          client: new ComgateApiClient(keys.api_key, keys.secret_key),
          merchant: keys.api_key,
          secret: keys.secret_key,
          projectSlugs: Array.isArray(config.project_slugs) ? config.project_slugs : [],
        })
      }
    }
    return out
  } catch (e: any) {
    logger.warn(`[Comgate Reconcile] config load failed: ${e.message}`)
    return []
  } finally {
    if (pgClient) {
      try { await pgClient.end() } catch {}
    }
  }
}

/**
 * Poll a transId against every active Comgate merchant and return the first
 * successful status (that's the merchant that owns the transaction). A transId
 * that doesn't belong to a merchant returns an error, so this correctly routes
 * multi-tenant transactions to the right eshop.
 */
type CgCfg = { client: ComgateApiClient; merchant: string; secret: string; projectSlugs: string[] }

async function getStatusAnyMerchant(
  configs: CgCfg[],
  transId: string
): Promise<{ success: boolean; data?: any; error?: string }> {
  for (const cfg of configs) {
    const res = await cfg.client.getStatus({ merchant: cfg.merchant, transId, secret: cfg.secret })
    if (res.success && res.data?.status) return res
  }
  return { success: false, data: null }
}

/**
 * Resolve the owning Comgate merchant from a stamped merchant id (comgateMerchant,
 * saved on the payment session at initiate) or the project slug. A transId belongs
 * to exactly one merchant; probing the wrong one makes Comgate email a
 * "Error 1400 — does not belong to the same shop" technical notification.
 */
function pickMerchantConfig(
  configs: CgCfg[],
  hint: { merchant?: string | null; projectSlug?: string | null }
): CgCfg | null {
  const m = String(hint.merchant || "").trim()
  if (m) { const c = configs.find((c) => c.merchant === m); if (c) return c }
  const p = String(hint.projectSlug || "").trim()
  if (p) { const c = configs.find((c) => c.projectSlugs.includes(p)); if (c) return c }
  return null
}

/**
 * getStatus routed to the owning merchant when it can be determined — so we hit
 * ONLY the right Comgate shop and never trigger cross-merchant error emails.
 * Falls back to try-all only when the merchant is genuinely unknown (legacy rows).
 */
async function getStatusForCandidate(
  configs: CgCfg[],
  transId: string,
  hint: { merchant?: string | null; projectSlug?: string | null }
): Promise<{ success: boolean; data?: any; error?: string }> {
  const target = pickMerchantConfig(configs, hint)
  if (target) {
    return target.client.getStatus({ merchant: target.merchant, transId, secret: target.secret })
  }
  return getStatusAnyMerchant(configs, transId)
}

/**
 * Capture an order's authorized payment via Medusa + emit payment.captured.
 * Mirror of the webhook captureOrderPayment.
 */
async function captureAndEmit(
  orderId: string,
  pool: any,
  container: MedusaContainer,
  logger: any
): Promise<void> {
  try {
    const paymentModule = container.resolve(Modules.PAYMENT) as any
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
        logger.info(`[Comgate Reconcile] Payment ${payRows[0].id} captured for order ${orderId}`)
      }
    }
  } catch (e: any) {
    logger.warn(`[Comgate Reconcile] Medusa capture failed for order ${orderId}: ${e.message}`)
  }

  try {
    const eventBus = container.resolve(Modules.EVENT_BUS)
    await eventBus.emit({ name: "payment.captured", data: { id: orderId } })
  } catch (e: any) {
    logger.warn(`[Comgate Reconcile] emit payment.captured failed: ${e.message}`)
  }
}

export default async function comgateReconcileJob(container: MedusaContainer) {
  const logger = container.resolve("logger")

  const comgateConfigs = await loadComgateConfigs(logger)
  if (!comgateConfigs.length) return // no active Comgate config → nothing to do

  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    // ───────────────────────────────────────────────────────────────────────
    // A) Uncompleted carts carrying a Comgate transId → poll → complete if PAID
    // ───────────────────────────────────────────────────────────────────────
    const { rows: cartCands } = await pool.query(
      `SELECT DISTINCT ON (c.id)
         c.id AS cart_id,
         c.email,
         COALESCE(ps.data->>'transId', ps.data->>'comgateTransId') AS trans_id,
         ps.data->>'comgateMerchant' AS comgate_merchant,
         COALESCE(c.metadata->>'project_id', ps.data->>'project_slug') AS project_slug
       FROM cart c
       JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
       JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
       JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE c.completed_at IS NULL
         AND ps.provider_id LIKE '%comgate%'
         AND (ps.data ? 'transId' OR ps.data ? 'comgateTransId')
         AND c.created_at > now() - interval '${CART_LOOKBACK}'
       ORDER BY c.id, c.created_at DESC
       LIMIT ${MAX_CANDIDATES}`
    )

    for (const cand of cartCands) {
      const transId = cand.trans_id
      if (!transId) continue
      try {
        const statusRes = await getStatusForCandidate(comgateConfigs, transId, {
          merchant: cand.comgate_merchant,
          projectSlug: cand.project_slug,
        })
        if (!statusRes.success || statusRes.data?.status !== "PAID") continue

        // Race: order may already exist (return path / webhook completed it).
        const { rows: existing } = await pool.query(
          `SELECT id FROM "order" WHERE metadata->>'comgateTransId' = $1 LIMIT 1`,
          [transId]
        )
        if (existing[0]) {
          // Order exists but cart wasn't marked complete in our query window —
          // make sure it's captured, then move on.
          await captureAndEmit(existing[0].id, pool, container, logger)
          continue
        }

        // Amount validation against the paid Comgate price (minor units).
        const paid = fromMinor(statusRes.data?.price)
        const totals = await cartLiveTotal(pool, cand.cart_id)
        if (totals && paid > 0 && Math.abs(totals.total - paid) > 0.02) {
          logger.error(
            `[Comgate Reconcile] amount mismatch ${transId}: cart=${totals.total} paid=${paid} — skip`
          )
          await alert(
            "Comgate reconcile: amount mismatch",
            `${transId} paid ${paid} but cart ${cand.cart_id} total ${totals.total}. Manual review.`
          )
          logPaymentEvent({
            intent_id: transId,
            cart_id: cand.cart_id,
            email: cand.email,
            project_slug: null,
            event_type: "comgate_reconcile_amount_mismatch",
            event_data: { paid, cart_total: totals?.total },
            error_code: "amount_mismatch",
          }).catch(() => {})
          continue
        }

        // Final dup-check just before completing.
        const { rows: dup } = await pool.query(
          `SELECT id FROM "order" WHERE metadata->>'comgateTransId' = $1 LIMIT 1`,
          [transId]
        )
        if (dup[0]) continue

        const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
        const result: any = await completeCartWorkflow(container).run({ input: { id: cand.cart_id } })
        const orderId =
          result?.result?.id || result?.result?.order?.id || result?.id || result?.order?.id || null
        if (!orderId) {
          logger.error(`[Comgate Reconcile] completeCartWorkflow returned no order for cart ${cand.cart_id} (${transId})`)
          continue
        }

        const stamp = {
          comgateTransId: transId,
          comgateStatus: "PAID",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          payment_method: statusRes.data?.method || "comgate",
          payment_provider: "comgate",
          completed_by: "comgate_reconcile_cron",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(stamp), orderId]
        )

        await captureAndEmit(orderId, pool, container, logger)

        logger.info(`[Comgate Reconcile] ✅ Recovered ${transId} → order ${orderId} (${paid} ${totals?.currency || ""})`)
        await alert(
          "Comgate reconcile: order recovered",
          `${transId} → order ${orderId} (${paid}). Deferred/missed-webhook payment recovered by cron.`
        )
        logPaymentEvent({
          intent_id: transId,
          cart_id: cand.cart_id,
          email: cand.email,
          project_slug: null,
          event_type: "comgate_reconcile_completed",
          event_data: { order_id: orderId, paid },
        }).catch(() => {})
      } catch (err: any) {
        logger.error(`[Comgate Reconcile] cart candidate ${transId} failed: ${err.message}`)
      }
    }

    // ───────────────────────────────────────────────────────────────────────
    // B) Orders with a Comgate transId that never got captured → poll → capture
    // ───────────────────────────────────────────────────────────────────────
    const { rows: orderCands } = await pool.query(
      `SELECT o.id AS order_id, o.email, o.metadata->>'comgateTransId' AS trans_id,
         o.metadata->>'comgateMerchant' AS comgate_merchant,
         o.metadata->>'project_id' AS project_slug
       FROM "order" o
       WHERE o.metadata->>'comgateTransId' IS NOT NULL
         AND COALESCE(o.metadata->>'payment_captured', '') <> 'true'
         AND COALESCE(o.metadata->>'comgateStatus', '') <> 'PAID'
         AND o.created_at > now() - interval '${ORDER_LOOKBACK}'
       ORDER BY o.created_at DESC
       LIMIT ${MAX_CANDIDATES}`
    )

    for (const cand of orderCands) {
      const transId = cand.trans_id
      if (!transId) continue
      try {
        const statusRes = await getStatusForCandidate(comgateConfigs, transId, {
          merchant: cand.comgate_merchant,
          projectSlug: cand.project_slug,
        })
        if (!statusRes.success || statusRes.data?.status !== "PAID") continue

        const stamp = {
          comgateStatus: "PAID",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          payment_method: statusRes.data?.method || "comgate",
          payment_provider: "comgate",
          completed_by: "comgate_reconcile_cron",
        }
        await pool.query(
          `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(stamp), cand.order_id]
        )

        await captureAndEmit(cand.order_id, pool, container, logger)

        logger.info(`[Comgate Reconcile] ✅ Late-captured ${transId} → order ${cand.order_id}`)
        logPaymentEvent({
          intent_id: transId,
          email: cand.email,
          project_slug: null,
          event_type: "comgate_reconcile_captured",
          event_data: { order_id: cand.order_id },
        }).catch(() => {})
      } catch (err: any) {
        logger.error(`[Comgate Reconcile] order candidate ${transId} failed: ${err.message}`)
      }
    }
  } catch (err: any) {
    logger.error(`[Comgate Reconcile] job failed: ${err.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

export const config = {
  name: "comgate-order-reconcile",
  schedule: "*/15 * * * *",
}
