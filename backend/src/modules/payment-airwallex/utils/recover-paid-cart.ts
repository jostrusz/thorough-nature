// @ts-nocheck
import { Modules } from "@medusajs/framework/utils"
import { forceAuthorizeCartSessions } from "./force-authorize"
import { logPaymentEvent } from "../../payment-debug/utils/log"

// NOTE: @medusajs/medusa/core-flows is imported DYNAMICALLY inside
// recoverPaidCart(), never at module top level. A static import here pulls
// core-flows into the import graph of src/jobs/airwallex-paid-orphan-sweeper,
// and Medusa's job loader silently fails to register such a job (the same
// reason the webhook route and safety-net-replay always used await import()).

/**
 * Shared recovery for "money captured at Airwallex but no Medusa order" carts.
 *
 * Used by:
 *   - webhooks/airwallex safety net (automatic, ~30s after succeeded webhook)
 *   - jobs/airwallex-paid-orphan-sweeper (durable backstop, every 10 min)
 *   - (manual) admin/safety-net-replay keeps its own copy of this flow
 *
 * The full pipeline: dedupe retry-churned duplicates → validate cart total
 * against the paid amount → force-authorize + remap sessions to the paid
 * intent → completeCartWorkflow → enrich order metadata → emit payment.captured.
 */

export interface RecoverResult {
  ok: boolean
  orderId?: string | null
  /** cart_not_found | cart_completed | order_exists | amount_mismatch | no_order_id | exception */
  reason?: string
  detail?: string
}

/**
 * Locate the uncompleted cart for a paid intent. Three strategies, in order:
 *
 *  1. payment_session.data contains the intent id (normal case)
 *  2. intent metadata.session_id → payment_session.id (survives retry churn:
 *     a re-submit overwrites session.intentId with a NEWER unpaid intent, but
 *     the paid intent's metadata still points at the session it was created for)
 *  3. cart_id parsed from the intent's return_url (same property — the paid
 *     intent's return_url carries the cart id it belongs to)
 */
export async function findCartForPaidIntent(
  pool: any,
  paymentIntentId: string,
  hints?: { sessionId?: string | null; returnUrl?: string | null }
): Promise<{ id: string; email: string | null; matched_by: string } | null> {
  // 1) Session data contains this intent id
  const bySession = await pool.query(
    `SELECT c.id, c.email
     FROM cart c
     JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
     JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
     JOIN payment_session ps ON ps.payment_collection_id = pc.id
     WHERE ps.data::text LIKE '%' || $1 || '%'
       AND c.completed_at IS NULL
     ORDER BY c.created_at DESC
     LIMIT 1`,
    [paymentIntentId]
  )
  if (bySession.rows[0]) return { ...bySession.rows[0], matched_by: "session_intent_id" }

  // 2) Intent metadata.session_id → payment_session.id
  const sessionId = hints?.sessionId
  if (sessionId && /^payses_/.test(sessionId)) {
    const bySessionId = await pool.query(
      `SELECT c.id, c.email
       FROM cart c
       JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
       JOIN payment_session ps ON ps.payment_collection_id = cpc.payment_collection_id
       WHERE ps.id = $1
         AND c.completed_at IS NULL
       LIMIT 1`,
      [sessionId]
    )
    if (bySessionId.rows[0]) return { ...bySessionId.rows[0], matched_by: "metadata_session_id" }
  }

  // 3) cart_id from return_url (e.g. ...?payment_return=1&cart_id=cart_XXX)
  const returnUrl = hints?.returnUrl || ""
  const cartIdMatch = returnUrl.match(/cart_id=(cart_[A-Z0-9]+)/i)
  if (cartIdMatch) {
    const byCartId = await pool.query(
      `SELECT id, email FROM cart WHERE id = $1 AND completed_at IS NULL LIMIT 1`,
      [cartIdMatch[1]]
    )
    if (byCartId.rows[0]) return { ...byCartId.rows[0], matched_by: "return_url_cart_id" }
  }

  return null
}

/**
 * Check whether an order already exists for this intent (metadata fast path +
 * payment-session fallback — same logic as the webhook's findOrderByIntentId).
 */
export async function findOrderIdForIntent(pool: any, paymentIntentId: string): Promise<string | null> {
  const direct = await pool.query(
    `SELECT id FROM "order" WHERE metadata->>'airwallexPaymentIntentId' = $1 LIMIT 1`,
    [paymentIntentId]
  )
  if (direct.rows[0]) return direct.rows[0].id

  const linked = await pool.query(
    `SELECT o.id
     FROM "order" o
     JOIN order_payment_collection opc ON opc.order_id = o.id
     JOIN payment_collection pc ON pc.id = opc.payment_collection_id
     JOIN payment_session ps ON ps.payment_collection_id = pc.id
     WHERE ps.data::text LIKE '%' || $1 || '%'
     ORDER BY o.created_at DESC
     LIMIT 1`,
    [paymentIntentId]
  )
  return linked.rows[0]?.id || null
}

export async function recoverPaidCart(
  scope: any,
  logger: any,
  opts: {
    cartId: string
    intentId: string
    paidAmount: number
    paymentMethod?: string
    /** written to order.metadata.completed_by, e.g. "airwallex_webhook_safety_net" */
    source: string
  }
): Promise<RecoverResult> {
  const { cartId, intentId, paidAmount, source } = opts
  const paymentMethod = opts.paymentMethod || "card"

  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    // 1) Cart must exist and be uncompleted
    const cartRes = await pool.query(
      `SELECT id, email, completed_at, currency_code FROM cart WHERE id = $1 LIMIT 1`,
      [cartId]
    )
    const cart = cartRes.rows[0]
    if (!cart) return { ok: false, reason: "cart_not_found" }
    if (cart.completed_at) {
      return { ok: false, reason: "cart_completed", detail: String(cart.completed_at) }
    }

    // 2) No duplicate orders for this intent
    const existingOrderId = await findOrderIdForIntent(pool, intentId)
    if (existingOrderId) {
      return { ok: false, reason: "order_exists", orderId: existingOrderId }
    }

    if (!(paidAmount > 0)) {
      return { ok: false, reason: "amount_mismatch", detail: `invalid paid amount ${paidAmount}` }
    }

    // 3) Dedupe retry churn — keep the OLDEST row per variant / shipping option.
    //    Repeated submits append duplicate line items, pushing the cart total
    //    above the paid amount; completeCartWorkflow would then reject.
    const itemDel = await pool.query(
      `UPDATE cart_line_item li SET deleted_at = NOW()
       WHERE li.cart_id = $1
         AND li.deleted_at IS NULL
         AND li.id NOT IN (
           SELECT DISTINCT ON (variant_id) id FROM cart_line_item
           WHERE cart_id = $1 AND deleted_at IS NULL
           ORDER BY variant_id, created_at ASC
         )`,
      [cartId]
    )
    const smDel = await pool.query(
      `UPDATE cart_shipping_method sm SET deleted_at = NOW()
       WHERE sm.cart_id = $1
         AND sm.deleted_at IS NULL
         AND sm.id NOT IN (
           SELECT DISTINCT ON (shipping_option_id) id FROM cart_shipping_method
           WHERE cart_id = $1 AND deleted_at IS NULL
           ORDER BY shipping_option_id, created_at ASC
         )`,
      [cartId]
    )
    if (itemDel.rowCount || smDel.rowCount) {
      logger.info(
        `[Paid Cart Recovery] Deduped cart ${cartId}: removed ${itemDel.rowCount} line item(s), ${smDel.rowCount} shipping method(s)`
      )
    }

    // 4) Cart total must match the captured amount (1-2 cent rounding tolerance)
    const totalRes = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(quantity * unit_price) FROM cart_line_item
                   WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS items_total,
         COALESCE((SELECT SUM(amount) FROM cart_shipping_method
                   WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS shipping_total`,
      [cartId]
    )
    const cartTotal = Number(totalRes.rows[0].items_total) + Number(totalRes.rows[0].shipping_total)
    if (Math.abs(cartTotal - paidAmount) > 0.02) {
      logPaymentEvent({
        intent_id: intentId,
        cart_id: cartId,
        email: cart.email,
        event_type: "safety_net_amount_mismatch",
        event_data: { paid: paidAmount, cart_total: cartTotal, source },
        error_code: "amount_mismatch",
      }).catch(() => {})
      return {
        ok: false,
        reason: "amount_mismatch",
        detail: `cart total ${cartTotal} ${cart.currency_code} vs paid ${paidAmount}`,
      }
    }

    logPaymentEvent({
      intent_id: intentId,
      cart_id: cartId,
      email: cart.email,
      event_type: "safety_net_completing",
      event_data: { paid: paidAmount, cart_total: cartTotal, source },
    }).catch(() => {})

    // 5) Force-authorize + remap the cart's payment session(s) to the paid intent
    await forceAuthorizeCartSessions(pool, cartId, intentId)

    // 6) Complete the cart
    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result: any = await completeCartWorkflow(scope).run({ input: { id: cartId } })
    const orderId =
      result?.result?.id || result?.result?.order?.id || result?.id || result?.order?.id || null
    if (!orderId) {
      logPaymentEvent({
        intent_id: intentId,
        cart_id: cartId,
        email: cart.email,
        event_type: "safety_net_unexpected_result",
        event_data: { result_keys: Object.keys(result || {}), source },
        error_code: "unexpected_result",
      }).catch(() => {})
      return { ok: false, reason: "no_order_id", detail: JSON.stringify(result).slice(0, 300) }
    }

    // 7) Enrich order metadata so webhooks/admin/invoicing find the payment
    const orderMetaRes = await pool.query(`SELECT metadata FROM "order" WHERE id = $1`, [orderId])
    const existingMeta = orderMetaRes.rows[0]?.metadata || {}
    const updatedMeta = {
      ...existingMeta,
      airwallexPaymentIntentId: intentId,
      airwallexStatus: "payment_intent.succeeded",
      payment_captured: true,
      payment_captured_at: new Date().toISOString(),
      payment_airwallex_intent_id: intentId,
      payment_method: paymentMethod,
      completed_by: source,
      safety_net_completed_at: new Date().toISOString(),
    }
    await pool.query(
      `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedMeta), orderId]
    )

    logPaymentEvent({
      intent_id: intentId,
      cart_id: cartId,
      email: cart.email,
      event_type: "safety_net_completed",
      event_data: { order_id: orderId, paid: paidAmount, source },
    }).catch(() => {})

    // 8) Emit payment.captured so subscribers (Fakturoid, Dextrum, e-books) react
    try {
      const eventBus = scope.resolve(Modules.EVENT_BUS)
      await eventBus.emit({ name: "payment.captured", data: { id: orderId } })
    } catch (e: any) {
      logger.warn(`[Paid Cart Recovery] Failed to emit payment.captured for ${orderId}: ${e.message}`)
    }

    logger.info(
      `[Paid Cart Recovery] ✅ Cart ${cartId} → order ${orderId} (intent ${intentId}, ${paidAmount}, source ${source})`
    )
    return { ok: true, orderId }
  } catch (err: any) {
    logPaymentEvent({
      intent_id: intentId,
      cart_id: cartId,
      event_type: "safety_net_failed",
      event_data: {
        message: err?.message || String(err),
        stack: (err?.stack || "").slice(0, 1000),
        source,
      },
      error_code: "safety_net_exception",
    }).catch(() => {})
    return { ok: false, reason: "exception", detail: err?.message || String(err) }
  } finally {
    await pool.end().catch(() => {})
  }
}
