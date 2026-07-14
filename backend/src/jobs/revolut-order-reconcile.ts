// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { RevolutApiClient } from "../modules/payment-revolut/api-client"
import { logPaymentEvent } from "../modules/payment-debug/utils/log"

/**
 * Revolut order reconciliation cron — durable poll-based backstop.
 *
 * Revolut Merchant payments (today: slipp-taket, NOK) run in an inline Web SDK
 * checkout. The real-time recovery path is the webhook (ORDER_COMPLETED →
 * safety-net cart completion), but a webhook is single-delivery: a missed push,
 * a process restart inside the 30s safety-net window, or a customer who closed
 * the browser right after paying (before POST /store/carts/{id}/complete ran)
 * leaves a paid Revolut order with no Medusa order — forever.
 *
 * Every 10 min this job finds Revolut payment sessions whose cart was never
 * completed, polls the Revolut order state, and when it is COMPLETED or
 * AUTHORISED completes the cart exactly like the webhook safety net does
 * (amount-validated ±0.02, dup-checked, metadata-stamped, payment.captured
 * emitted so e-book / WMS / invoice subscribers react).
 *
 * Idempotent: candidates are pre-filtered against existing orders in SQL and
 * re-checked (cart + order) immediately before completeCartWorkflow, so it can
 * never double-create an order.
 */

const NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"
const SESSION_LOOKBACK = "48 hours" // how far back to sweep for orphaned sessions
const SESSION_MIN_AGE = "10 minutes" // skip checkouts that may still be in-flight
const MAX_CANDIDATES = 20

/** Revolut order states that mean "money is (or will be) ours" → complete cart. */
const PAID_STATES = ["COMPLETED", "AUTHORISED"]

async function alert(title: string, message: string): Promise<void> {
  try {
    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        Title: Buffer.from(title, "utf-8").toString("base64"),
        "X-Title-Encoding": "base64",
        Priority: "high",
        Tags: "warning,revolut,reconcile",
      },
      body: message,
    })
  } catch {
    /* alerting must never break the job */
  }
}

/** Live cart total + currency for amount validation (mirror of webhook getCartLiveTotal). */
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
 * Load API clients for every active Revolut gateway (mirror of the webhook's
 * getRevolutGateways). live_keys.secret_key (or api_key) + mode → base URL.
 */
async function loadRevolutClients(pool: any, logger: any): Promise<RevolutApiClient[]> {
  const clients: RevolutApiClient[] = []
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys FROM gateway_config
       WHERE provider = 'revolut' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    for (const r of rows) {
      const isLive = r.mode === "live"
      let keys = isLive ? r.live_keys : r.test_keys
      if (typeof keys === "string") {
        try { keys = JSON.parse(keys) } catch { keys = null }
      }
      const secretKey = keys?.secret_key || keys?.api_key
      if (secretKey) clients.push(new RevolutApiClient(secretKey, !isLive))
    }
  } catch (e: any) {
    logger.warn(`[Revolut Reconcile] gateway config load failed: ${e.message}`)
  }
  return clients
}

/** Fetch a Revolut order, trying each configured gateway (an id belongs to exactly one). */
async function getOrderAnyGateway(
  clients: RevolutApiClient[],
  revolutOrderId: string
): Promise<any | null> {
  for (const client of clients) {
    try {
      const order = await client.getOrder(revolutOrderId)
      if (order?.id) return order
    } catch {
      // wrong gateway (404) or transient error — try the next one
    }
  }
  return null
}

/** True if a Medusa order already exists for this Revolut order id. */
async function orderExists(pool: any, revolutOrderId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT id FROM "order" WHERE metadata->>'revolutOrderId' = $1 LIMIT 1`,
    [revolutOrderId]
  )
  return !!rows[0]
}

/** True if the cart got completed in the meantime (race with return path / webhook). */
async function cartCompleted(pool: any, cartId: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT completed_at FROM cart WHERE id = $1 LIMIT 1`,
    [cartId]
  )
  return !!rows[0]?.completed_at
}

export default async function revolutReconcileJob(container: MedusaContainer) {
  const logger = container.resolve("logger")

  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  let checked = 0
  let completed = 0
  let skipped = 0

  try {
    const clients = await loadRevolutClients(pool, logger)
    if (!clients.length) return // no active Revolut gateway → nothing to do

    // Revolut payment sessions (last 48h, older than 10 min) whose cart was
    // never completed and for which no order carries the same revolutOrderId.
    const { rows: candidates } = await pool.query(
      `SELECT DISTINCT ON (c.id)
         c.id AS cart_id,
         c.email,
         ps.data->>'revolutOrderId' AS revolut_order_id,
         ps.data->>'method' AS method,
         COALESCE(c.metadata->>'project_id', ps.data->>'project_slug') AS project_slug
       FROM cart c
       JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
       JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
       JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE c.completed_at IS NULL
         AND ps.provider_id LIKE '%revolut%'
         AND ps.data ? 'revolutOrderId'
         AND ps.created_at > now() - interval '${SESSION_LOOKBACK}'
         AND ps.created_at < now() - interval '${SESSION_MIN_AGE}'
         AND NOT EXISTS (
           SELECT 1 FROM "order" o
           WHERE o.metadata->>'revolutOrderId' = ps.data->>'revolutOrderId'
         )
       ORDER BY c.id, ps.created_at DESC
       LIMIT ${MAX_CANDIDATES}`
    )

    for (const cand of candidates) {
      const revolutOrderId = cand.revolut_order_id
      if (!revolutOrderId) continue
      checked++
      try {
        const revolutOrder = await getOrderAnyGateway(clients, revolutOrderId)
        if (!revolutOrder) {
          skipped++
          continue // unknown to every gateway / API unreachable — retry next run
        }

        const state = String(revolutOrder.state || "").toUpperCase()
        if (!PAID_STATES.includes(state)) {
          skipped++
          logger.info(
            `[Revolut Reconcile] ${revolutOrderId} state=${state} — skip (cart ${cand.cart_id})`
          )
          continue
        }

        // ─── AMOUNT VALIDATION (±0.02, mirror of webhook safety net) ───
        // api-client already converts minor → MAJOR units; cart totals are MAJOR.
        const totals = await cartLiveTotal(pool, cand.cart_id)
        const paid = Number(revolutOrder.amount || 0)
        if (totals && paid > 0 && Math.abs(totals.total - paid) > 0.02) {
          skipped++
          const msg =
            `Revolut order ${revolutOrderId} paid ${paid} ${revolutOrder.currency} ` +
            `but cart ${cand.cart_id} (${cand.email}) total is ${totals.total}. Manual review.`
          logger.error(`[Revolut Reconcile] amount mismatch: ${msg}`)
          await alert("Revolut reconcile: amount mismatch", msg)
          logPaymentEvent({
            intent_id: revolutOrderId,
            cart_id: cand.cart_id,
            email: cand.email,
            project_slug: cand.project_slug || null,
            event_type: "revolut_reconcile_amount_mismatch",
            event_data: { paid, cart_total: totals.total, currency: revolutOrder.currency, state },
            error_code: "amount_mismatch",
          }).catch(() => {})
          continue
        }

        // ─── IDEMPOTENCE: fresh re-check just before completing ───
        // The return path or webhook safety net may have completed it meanwhile.
        if ((await orderExists(pool, revolutOrderId)) || (await cartCompleted(pool, cand.cart_id))) {
          skipped++
          logger.info(
            `[Revolut Reconcile] ${revolutOrderId} already completed elsewhere — skip`
          )
          continue
        }

        logPaymentEvent({
          intent_id: revolutOrderId,
          cart_id: cand.cart_id,
          email: cand.email,
          project_slug: cand.project_slug || null,
          event_type: "revolut_reconcile_completing",
          event_data: { paid, cart_total: totals?.total ?? null, state },
        }).catch(() => {})

        const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
        const result: any = await completeCartWorkflow(container).run({
          input: { id: cand.cart_id },
        })
        const orderId =
          result?.result?.id || result?.result?.order?.id || result?.id || result?.order?.id || null
        if (!orderId) {
          skipped++
          logger.error(
            `[Revolut Reconcile] completeCartWorkflow returned no order for cart ${cand.cart_id} (${revolutOrderId})`
          )
          await alert(
            "Revolut reconcile: unexpected result",
            `completeCartWorkflow returned no order for cart ${cand.cart_id} / Revolut order ${revolutOrderId}`
          )
          continue
        }

        // Stamp metadata like the webhook safety net does (merge, don't replace).
        const stamp: any = {
          revolutOrderId,
          revolutStatus: state,
          payment_provider: "revolut",
          payment_method: cand.method || "card",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          completed_by: "revolut_reconcile_cron",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(stamp), orderId]
        )

        // Emit payment.captured so subscribers (e-book, WMS, Fakturoid) react.
        try {
          const eventBus = container.resolve(Modules.EVENT_BUS)
          await eventBus.emit({ name: "payment.captured", data: { id: orderId } })
        } catch (e: any) {
          logger.warn(`[Revolut Reconcile] emit payment.captured failed: ${e.message}`)
        }

        completed++
        logger.info(
          `[Revolut Reconcile] ✅ Recovered ${revolutOrderId} → order ${orderId} (${paid} ${revolutOrder.currency || ""})`
        )
        await alert(
          "Revolut reconcile: order recovered",
          `${revolutOrderId} → order ${orderId} (${paid} ${revolutOrder.currency || ""}). Missed-webhook/abandoned-return payment recovered by cron.`
        )
        logPaymentEvent({
          intent_id: revolutOrderId,
          cart_id: cand.cart_id,
          email: cand.email,
          project_slug: cand.project_slug || null,
          event_type: "revolut_reconcile_completed",
          event_data: { order_id: orderId, paid, state },
        }).catch(() => {})
      } catch (err: any) {
        skipped++
        logger.error(
          `[Revolut Reconcile] candidate ${revolutOrderId} (cart ${cand.cart_id}) failed: ${err.message}`
        )
      }
    }

    if (checked > 0) {
      logger.info(`[Revolut Reconcile] checked=${checked} completed=${completed} skipped=${skipped}`)
    }
  } catch (err: any) {
    logger.error(`[Revolut Reconcile] job failed: ${err.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

export const config = {
  name: "revolut-order-reconcile",
  schedule: "*/10 * * * *",
}
