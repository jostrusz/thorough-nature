// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  findCartForPaidIntent,
  findOrderIdForIntent,
  recoverPaidCart,
} from "../modules/payment-airwallex/utils/recover-paid-cart"
import { logPaymentEvent } from "../modules/payment-debug/utils/log"
import { sendOpsAlert } from "../utils/ops-alert"

/**
 * Airwallex Paid-Orphan Sweeper — durable backstop for the webhook safety net.
 *
 * The inline safety net (webhooks/airwallex) waits 30s in-memory before
 * completing a paid-but-orderless cart. That timer dies when the container is
 * restarted/redeployed mid-wait (proven cause of lost recoveries: PL2026-16658,
 * PL2026-16661). This job replays the same recovery from durable state:
 *
 *   1. Find `payment_intent.succeeded` webhook events in payment_journey_log
 *      (last 48h, older than 2 min so the inline net gets first shot)
 *   2. Skip intents that already have an order, were already recovered, or
 *      were marked gave-up
 *   3. Locate the cart (session intent / metadata.session_id from journey
 *      events / cart_id parsed from the intent's return_url) and run the
 *      shared recovery pipeline
 *   4. Terminal failures (cart completed = possible double payment, amount
 *      mismatch, no cart) → give up immediately + ops alert.
 *      Transient failures (exception) → retry next run, give up + alert after
 *      MAX_ATTEMPTS.
 *
 * Bookkeeping events written to payment_journey_log:
 *   sweeper_attempt, sweeper_gave_up (recovery success logs safety_net_completed
 *   via the shared util)
 */

const LOOKBACK_HOURS = 48
const MIN_AGE_MINUTES = 2 // leave the inline 30s safety net room to finish
const MAX_ATTEMPTS = 5
const MAX_PER_RUN = 25

export default async function airwallexPaidOrphanSweeper(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    // Succeeded intents in the window with no recovery resolution yet.
    // Order-existence is checked per-intent below (the LIKE probe is too heavy
    // to run as a correlated subquery across the whole window).
    const { rows: candidates } = await pool.query(
      `SELECT DISTINCT ON (l.intent_id)
              l.intent_id,
              (l.event_data->>'amount')::numeric   AS amount,
              l.event_data->>'currency'            AS currency,
              l.event_data->>'payment_method_type' AS payment_method,
              l.occurred_at
       FROM payment_journey_log l
       WHERE l.event_type = 'airwallex_webhook_received'
         AND l.event_data->>'airwallex_event' = 'payment_intent.succeeded'
         AND l.occurred_at > NOW() - INTERVAL '${LOOKBACK_HOURS} hours'
         AND l.occurred_at < NOW() - INTERVAL '${MIN_AGE_MINUTES} minutes'
         AND NOT EXISTS (
           SELECT 1 FROM payment_journey_log g
           WHERE g.intent_id = l.intent_id
             AND g.event_type IN ('safety_net_completed', 'sweeper_gave_up')
         )
       ORDER BY l.intent_id, l.occurred_at DESC
       LIMIT ${MAX_PER_RUN * 4}`
    )

    // Heartbeat — proves the cron is registered and ticking (grep-able in Railway)
    logger.info(`[Orphan Sweeper] Tick: ${candidates.length} succeeded-intent candidate(s) in window`)
    if (!candidates.length) return

    let processed = 0
    let recovered = 0

    for (const cand of candidates) {
      if (processed >= MAX_PER_RUN) break
      const intentId = cand.intent_id

      // Already has an order? (covers normal checkout completion, the inline
      // safety net, manual replay — all set metadata or keep session linkage)
      const existingOrderId = await findOrderIdForIntent(pool, intentId)
      if (existingOrderId) continue

      processed++

      // Attempt cap for transient failures
      const { rows: attemptRows } = await pool.query(
        `SELECT count(*)::int AS attempts FROM payment_journey_log
         WHERE intent_id = $1 AND event_type = 'sweeper_attempt'`,
        [intentId]
      )
      const attempts = attemptRows[0]?.attempts || 0

      // Recovery hints from the intent-creation journey event (return_url
      // carries the cart_id; the webhook event itself doesn't store it)
      const { rows: createdRows } = await pool.query(
        `SELECT event_data->>'return_url' AS return_url, email, project_slug
         FROM payment_journey_log
         WHERE intent_id = $1 AND event_type = 'airwallex_intent_created'
         ORDER BY occurred_at ASC
         LIMIT 1`,
        [intentId]
      )
      const hints = {
        sessionId: null, // not persisted in journey events; session/return_url cover it
        returnUrl: createdRows[0]?.return_url || null,
      }

      await logPaymentEvent({
        intent_id: intentId,
        email: createdRows[0]?.email || null,
        project_slug: createdRows[0]?.project_slug || null,
        event_type: "sweeper_attempt",
        event_data: { attempt: attempts + 1, amount: Number(cand.amount) || null },
      }).catch(() => {})

      const giveUp = async (reason: string, detail: string, alert = true) => {
        await logPaymentEvent({
          intent_id: intentId,
          event_type: "sweeper_gave_up",
          event_data: { reason, detail, attempts: attempts + 1 },
          error_code: reason,
        }).catch(() => {})
        if (alert) {
          await sendOpsAlert(
            `Orphan sweeper: gave up (${reason})`,
            `Intent ${intentId} (${cand.amount} ${(cand.currency || "").toUpperCase()}, ` +
              `${cand.payment_method || "?"}, customer ${createdRows[0]?.email || "?"}) is PAID at Airwallex ` +
              `but could not be recovered automatically: ${detail}\n\n` +
              `Manual recovery: POST /admin/safety-net-replay or refund.`
          )
        }
      }

      const cartRef = await findCartForPaidIntent(pool, intentId, hints)
      if (!cartRef) {
        await giveUp("no_cart", "no uncompleted cart found via session, or return_url")
        continue
      }

      const paidAmount = Number(cand.amount) || 0
      const result = await recoverPaidCart(container, logger, {
        cartId: cartRef.id,
        intentId,
        paidAmount,
        paymentMethod: cand.payment_method || "card",
        source: "airwallex_orphan_sweeper",
      })

      if (result.ok) {
        recovered++
        logger.info(
          `[Orphan Sweeper] ✅ Recovered intent ${intentId} → order ${result.orderId} (cart ${cartRef.id}, matched by ${cartRef.matched_by})`
        )
        continue
      }

      switch (result.reason) {
        case "order_exists":
          // resolved concurrently — nothing to do
          break
        case "cart_completed":
          // Cart was completed under a DIFFERENT intent → this succeeded intent
          // may be a double payment. Needs human eyes (possible refund).
          await giveUp(
            "cart_completed",
            `cart ${cartRef.id} was already completed under a different intent — possible DOUBLE PAYMENT, check if a refund is due`
          )
          break
        case "amount_mismatch":
        case "cart_not_found":
          await giveUp(result.reason, result.detail || "")
          break
        default:
          // transient (exception / no_order_id) → retry next run until cap
          if (attempts + 1 >= MAX_ATTEMPTS) {
            await giveUp(result.reason || "exception", result.detail || "", true)
          } else {
            logger.warn(
              `[Orphan Sweeper] Attempt ${attempts + 1}/${MAX_ATTEMPTS} failed for intent ${intentId}: ${result.reason} — ${result.detail || ""}. Will retry.`
            )
          }
          break
      }
    }

    if (processed > 0) {
      logger.info(
        `[Orphan Sweeper] Done: ${processed} orphan candidate(s) processed, ${recovered} recovered`
      )
    }
  } catch (err: any) {
    logger.error(`[Orphan Sweeper] Run failed: ${err.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

export const config = {
  name: "airwallex-paid-orphan-sweeper",
  schedule: "*/10 * * * *", // every 10 minutes
}
