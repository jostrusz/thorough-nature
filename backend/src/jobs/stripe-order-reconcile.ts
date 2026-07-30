// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import Stripe from "stripe"
import { logPaymentEvent } from "../modules/payment-debug/utils/log"

/**
 * Stripe order reconciliation cron — durable backstop for the webhook safety-net.
 *
 * Unlike the PayU variant (which replays our own webhook log), the source of
 * truth here is the Stripe API itself: every 15 min we list *succeeded*
 * PaymentIntents of the last 48 h for each active Stripe gateway. That catches
 * everything the in-process safety-net can miss — a restart inside its 30 s
 * window, a webhook outage, or a webhook that arrived before the order existed.
 *
 * For each paid intent with no matching order:
 *   - uncompleted cart found  → validate amount → completeCartWorkflow → stamp
 *   - cart already completed  → the order exists but was never stamped
 *     (metadata-subscriber race) → stamp metadata only, no new order
 *
 * Idempotent: acts only on carts with completed_at IS NULL, re-checks for the
 * order right before completing, and metadata stamping is a merge.
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
        Tags: "warning,stripe,reconcile",
      },
      body: message,
    })
  } catch {
    /* ignore */
  }
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

/** Merge Stripe payment info into order.metadata (never overwrites other keys). */
async function stampOrder(
  pool: any,
  orderId: string,
  pi: any,
  completedBy: string | null
): Promise<void> {
  const patch: any = {
    stripePaymentIntentId: pi.id,
    stripeStatus: "payment_intent.succeeded",
    payment_captured: true,
    payment_captured_at: new Date().toISOString(),
    payment_provider: "stripe",
    payment_method: pi.metadata?.method || pi.payment_method_types?.[0] || "card",
  }
  if (completedBy) {
    patch.completed_by = completedBy
    patch.safety_net_completed_at = new Date().toISOString()
  }
  await pool.query(
    `UPDATE "order"
     SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW()
     WHERE id = $2
       AND (metadata->>'stripePaymentIntentId' IS NULL OR metadata->>'payment_captured' IS NULL)`,
    [JSON.stringify(patch), orderId]
  )
}

export default async function stripeReconcileJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    // Active live-mode Stripe gateways → one API sweep per distinct secret key
    const { rows: gateways } = await pool.query(
      `SELECT display_name, live_keys->>'api_key' AS api_key
       FROM gateway_config
       WHERE provider = 'stripe' AND is_active = true AND mode = 'live' AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    const seenKeys = new Set<string>()

    for (const gw of gateways) {
      if (!gw.api_key || seenKeys.has(gw.api_key)) continue
      seenKeys.add(gw.api_key)

      const stripe = new Stripe(gw.api_key, { apiVersion: "2025-03-31.basil" as any })
      const since = Math.floor(Date.now() / 1000) - 48 * 3600

      let intents: any[] = []
      try {
        let page = await stripe.paymentIntents.list({ created: { gte: since }, limit: 100 })
        intents = intents.concat(page.data)
        // volume safeguard: at most 3 pages (300 intents / 48h per gateway)
        for (let i = 0; i < 2 && page.has_more; i++) {
          page = await stripe.paymentIntents.list({
            created: { gte: since },
            limit: 100,
            starting_after: page.data[page.data.length - 1].id,
          })
          intents = intents.concat(page.data)
        }
      } catch (e: any) {
        logger.error(`[Stripe Reconcile] PI list failed for "${gw.display_name}": ${e.message}`)
        continue
      }

      const succeeded = intents.filter((pi: any) => pi.status === "succeeded")
      if (!succeeded.length) continue

      for (const pi of succeeded) {
        try {
          // Order already stamped with this intent? Nothing to do.
          const { rows: existing } = await pool.query(
            `SELECT id FROM "order" WHERE metadata->>'stripePaymentIntentId' = $1 LIMIT 1`,
            [pi.id]
          )
          if (existing[0]) continue

          // Locate the cart carrying this intent in any of its payment sessions.
          const { rows: cartRows } = await pool.query(
            `SELECT c.id, c.email, c.completed_at
             FROM payment_session ps
             JOIN cart_payment_collection cpc ON cpc.payment_collection_id = ps.payment_collection_id
             JOIN cart c ON c.id = cpc.cart_id
             WHERE ps.data->>'stripePaymentIntentId' = $1
                OR ps.data->>'stripeCheckoutSessionId' = $1
                OR ps.data->>'payment_intent' = $1
             ORDER BY c.created_at DESC LIMIT 1`,
            [pi.id]
          )
          const cart = cartRows[0]
          if (!cart) continue // paid on another system / test — nothing to anchor to

          if (cart.completed_at) {
            // Order exists but was never stamped (metadata-subscriber race).
            const { rows: oc } = await pool.query(
              `SELECT order_id FROM order_cart WHERE cart_id = $1 LIMIT 1`,
              [cart.id]
            )
            if (oc[0]?.order_id) {
              await stampOrder(pool, oc[0].order_id, pi, null)
              logger.info(
                `[Stripe Reconcile] healed metadata: ${pi.id} → order ${oc[0].order_id}`
              )
            }
            continue
          }

          // Uncompleted cart with a paid intent → the customer paid and never
          // came back, and the realtime safety-net missed it. Validate amount.
          const paid = pi.amount / 100
          const totals = await cartLiveTotal(pool, cart.id)
          if (totals && paid > 0 && Math.abs(totals.total - paid) > 0.02) {
            logger.error(
              `[Stripe Reconcile] amount mismatch ${pi.id}: cart=${totals.total} paid=${paid} — skip`
            )
            await alert(
              "Stripe reconcile: amount mismatch",
              `${pi.id} paid ${paid} but cart ${cart.id} total ${totals.total}. Manual review.`
            )
            logPaymentEvent({
              intent_id: pi.id,
              cart_id: cart.id,
              email: cart.email,
              event_type: "stripe_reconcile_amount_mismatch",
              event_data: { paid, cart_total: totals?.total },
              error_code: "amount_mismatch",
            })
            continue
          }

          // Final dup-check — race with the realtime safety-net.
          const { rows: dup } = await pool.query(
            `SELECT id FROM "order" WHERE metadata->>'stripePaymentIntentId' = $1 LIMIT 1`,
            [pi.id]
          )
          if (dup[0]) continue

          const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
          const result: any = await completeCartWorkflow(container).run({ input: { id: cart.id } })
          const orderId =
            result?.result?.id || result?.result?.order?.id || result?.id || result?.order?.id || null
          if (!orderId) {
            logger.error(
              `[Stripe Reconcile] completeCartWorkflow returned no order id for cart ${cart.id} (${pi.id})`
            )
            continue
          }

          await stampOrder(pool, orderId, pi, "stripe_reconcile_cron")

          try {
            const eventBus = container.resolve(Modules.EVENT_BUS)
            await eventBus.emit({ name: "payment.captured", data: { id: orderId } })
          } catch (e: any) {
            logger.warn(`[Stripe Reconcile] emit payment.captured failed: ${e.message}`)
          }

          logger.info(
            `[Stripe Reconcile] ✅ Recovered ${pi.id} → order ${orderId} (${paid} ${pi.currency})`
          )
          await alert(
            "Stripe reconcile: order recovered",
            `${pi.id} → order ${orderId} (${paid} ${pi.currency}). Missed by realtime safety-net, recovered by cron.`
          )
          logPaymentEvent({
            intent_id: pi.id,
            cart_id: cart.id,
            email: cart.email,
            event_type: "stripe_reconcile_completed",
            event_data: { order_id: orderId, paid },
          })
        } catch (err: any) {
          logger.error(`[Stripe Reconcile] failed for ${pi.id}: ${err.message}`)
        }
      }
    }
  } catch (err: any) {
    logger.error(`[Stripe Reconcile] job failed: ${err.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

export const config = {
  name: "stripe-order-reconcile",
  schedule: "*/15 * * * *",
}
