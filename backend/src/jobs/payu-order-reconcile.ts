// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { logPaymentEvent } from "../modules/payment-debug/utils/log"

/**
 * PayU order reconciliation cron — durable backstop for the in-process safety-net.
 *
 * When PayU delivers a COMPLETED IPN, the webhook acks 200 immediately and
 * schedules an async, 30s-delayed cart completion. If the web process restarts
 * (deploy / crash / OOM / Railway autoscale) inside that 30s window, the
 * callback is killed and the order is silently lost — PayU got its 200, so it
 * never retries. (Confirmed root cause of CZ2026-21065 / Hrabovská, 2026-06-26:
 * COMPLETED IPN at 08:03:26 UTC, backend deploy at 07:59:05 UTC.)
 *
 * Every 10 min this job finds payments that received a COMPLETED IPN but never
 * converted to an order, validates the amount, and runs completeCartWorkflow —
 * the same logic as the real-time safety-net, just durable. Idempotent: only
 * acts on carts with completed_at IS NULL and re-checks for a race before
 * completing, so it can never double-create an order.
 */

const NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"

async function alert(title: string, message: string): Promise<void> {
  try {
    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        Title: Buffer.from(title, "utf-8").toString("base64"),
        "X-Title-Encoding": "base64",
        Priority: "high",
        Tags: "warning,payu,reconcile",
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

export default async function payuReconcileJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    // Candidates: a COMPLETED IPN arrived in the last 7 days, but no order
    // carries that PayU id. DISTINCT keeps the most recent event per order.
    const { rows: candidates } = await pool.query(
      `SELECT DISTINCT ON (j.intent_id)
         j.intent_id                    AS payu_order_id,
         j.event_data->>'ext_order_id'  AS ext_order_id,
         j.event_data->>'amount'        AS amount_minor,
         j.event_data->>'pay_method'    AS pay_method
       FROM payment_journey_log j
       WHERE j.event_type = 'payu_webhook_received'
         AND j.event_data->>'status' = 'COMPLETED'
         AND j.occurred_at > now() - interval '7 days'
         AND NOT EXISTS (
           SELECT 1 FROM "order" o
           WHERE o.metadata->>'payu_order_id' = j.intent_id
              OR o.metadata->>'payu_ext_order_id' = j.event_data->>'ext_order_id'
         )
       ORDER BY j.intent_id, j.occurred_at DESC`
    )
    if (!candidates.length) return

    logger.info(`[PayU Reconcile] ${candidates.length} COMPLETED-but-no-order candidate(s) to check`)

    for (const cand of candidates) {
      const payuOrderId = cand.payu_order_id
      const extOrderId = cand.ext_order_id
      try {
        // Find an UNCOMPLETED cart carrying this PayU id (mirror of safety-net).
        const search: string[] = [payuOrderId]
        let where = `ps.data::text LIKE '%' || $1 || '%'`
        if (extOrderId) {
          search.push(extOrderId)
          where += ` OR ps.data::text LIKE '%' || $2 || '%'`
        }
        const { rows: cartRows } = await pool.query(
          `SELECT c.id, c.email
           FROM cart c
           JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
           JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
           JOIN payment_session ps ON ps.payment_collection_id = pc.id
           WHERE (${where}) AND c.completed_at IS NULL
           ORDER BY c.created_at DESC LIMIT 1`,
          search
        )
        const cart = cartRows[0]
        // No uncompleted cart → already completed elsewhere (e.g. return path) → nothing to do.
        if (!cart) continue

        // Amount validation against the paid IPN amount (minor units).
        const paid = fromMinor(cand.amount_minor)
        const totals = await cartLiveTotal(pool, cart.id)
        if (totals && paid > 0 && Math.abs(totals.total - paid) > 0.02) {
          logger.error(
            `[PayU Reconcile] amount mismatch ${payuOrderId}: cart=${totals.total} paid=${paid} — skip`
          )
          await alert(
            "PayU reconcile: amount mismatch",
            `${payuOrderId} paid ${paid} but cart ${cart.id} total ${totals.total}. Manual review.`
          )
          logPaymentEvent({
            intent_id: payuOrderId,
            cart_id: cart.id,
            email: cart.email,
            event_type: "payu_reconcile_amount_mismatch",
            event_data: { paid, cart_total: totals?.total },
            error_code: "amount_mismatch",
          }).catch(() => {})
          continue
        }

        // Final dup-check — race with the real-time safety-net.
        const { rows: dup } = await pool.query(
          `SELECT 1 FROM "order" WHERE metadata->>'payu_order_id' = $1 LIMIT 1`,
          [payuOrderId]
        )
        if (dup[0]) continue

        // Complete the cart (creates the order).
        const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
        const result: any = await completeCartWorkflow(container).run({ input: { id: cart.id } })
        const orderId =
          result?.result?.id || result?.result?.order?.id || result?.id || result?.order?.id || null
        if (!orderId) {
          logger.error(
            `[PayU Reconcile] completeCartWorkflow returned no order id for cart ${cart.id} (${payuOrderId})`
          )
          continue
        }

        // Stamp PayU metadata (mirror of the webhook safety-net).
        const updated = {
          payu_order_id: payuOrderId,
          payu_ext_order_id: extOrderId,
          payu_status: "COMPLETED",
          payment_captured: true,
          payment_captured_at: new Date().toISOString(),
          payment_method: cand.pay_method || "payu",
          payment_provider: "payu",
          completed_by: "payu_reconcile_cron",
          safety_net_completed_at: new Date().toISOString(),
        }
        await pool.query(
          `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updated), orderId]
        )

        // Emit payment.captured → order confirmation email, e-book, Dextrum, invoice.
        try {
          const eventBus = container.resolve(Modules.EVENT_BUS)
          await eventBus.emit({ name: "payment.captured", data: { id: orderId } })
        } catch (e: any) {
          logger.warn(`[PayU Reconcile] emit payment.captured failed: ${e.message}`)
        }

        logger.info(
          `[PayU Reconcile] ✅ Recovered ${payuOrderId} → order ${orderId} (${paid} ${totals?.currency || ""})`
        )
        await alert(
          "PayU reconcile: order recovered",
          `${payuOrderId} → order ${orderId} (${paid}). Lost real-time safety-net (restart?), recovered by cron.`
        )
        logPaymentEvent({
          intent_id: payuOrderId,
          cart_id: cart.id,
          email: cart.email,
          event_type: "payu_reconcile_completed",
          event_data: { order_id: orderId, paid },
        }).catch(() => {})
      } catch (err: any) {
        logger.error(`[PayU Reconcile] failed for ${payuOrderId}: ${err.message}`)
      }
    }
  } catch (err: any) {
    logger.error(`[PayU Reconcile] job failed: ${err.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

export const config = {
  name: "payu-order-reconcile",
  schedule: "*/10 * * * *",
}
