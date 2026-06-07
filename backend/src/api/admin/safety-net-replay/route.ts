// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { forceAuthorizeCartSessions } from "../../../modules/payment-airwallex/utils/force-authorize"

/**
 * POST /admin/safety-net-replay
 *
 * Manually complete a cart that was paid but never converted to an order
 * (typically when the Airwallex safety-net failed to match the right intent,
 * or when a cart accumulated duplicate line items from repeated submits and
 * its total no longer matched the paid amount).
 *
 * Body:
 *   - cart_id: string (required)
 *   - payment_intent_id: string (required, Airwallex intent ID known to be SUCCEEDED)
 *   - paid_amount: number (required, in major units, used to validate cleanup target)
 *   - payment_method: string (optional, e.g. "p24", "card") — written to order metadata
 *   - dedupe: boolean (optional, default true) — soft-delete duplicate line items
 *             and shipping methods so cart total equals paid_amount
 *
 * Returns: { order_id, cart_id, intent_id, cleaned: { line_items, shipping_methods } }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const body = (req.body || {}) as Record<string, any>

  const cartId = String(body.cart_id || "")
  const intentId = String(body.payment_intent_id || "")
  const paidAmount = Number(body.paid_amount || 0)
  const paymentMethod = body.payment_method ? String(body.payment_method) : "card"
  const dedupe = body.dedupe !== false

  if (!cartId || !intentId || !paidAmount) {
    return res.status(400).json({
      error: "cart_id, payment_intent_id and paid_amount are required",
    })
  }

  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    // 1) Cart must exist and be uncompleted
    const cartRes = await pool.query(
      `SELECT id, email, completed_at, currency_code FROM cart WHERE id = $1 LIMIT 1`,
      [cartId]
    )
    const cart = cartRes.rows[0]
    if (!cart) return res.status(404).json({ error: `Cart ${cartId} not found` })
    if (cart.completed_at) {
      return res.status(409).json({ error: `Cart ${cartId} already completed at ${cart.completed_at}` })
    }

    // 2) Make sure no order already exists for this intent
    const dup = await pool.query(
      `SELECT o.id FROM "order" o
       LEFT JOIN order_payment_collection opc ON opc.order_id = o.id
       LEFT JOIN payment_collection pc ON pc.id = opc.payment_collection_id
       LEFT JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE o.metadata->>'airwallexPaymentIntentId' = $1
          OR ps.data::text LIKE '%' || $1 || '%'
       LIMIT 1`,
      [intentId]
    )
    if (dup.rows[0]) {
      return res.status(409).json({ error: `Order ${dup.rows[0].id} already exists for intent ${intentId}` })
    }

    const cleaned = { line_items: 0, shipping_methods: 0 }

    // 3) Optional dedupe — keep the OLDEST row per (variant_id) for items and
    //    the OLDEST row per (shipping_option_id) for shipping methods.
    if (dedupe) {
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
      cleaned.line_items = itemDel.rowCount || 0

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
      cleaned.shipping_methods = smDel.rowCount || 0
    }

    // 4) Validate cart total matches paid amount
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
      return res.status(422).json({
        error: `Cart total ${cartTotal} ${cart.currency_code} does not match paid_amount ${paidAmount}`,
        cleaned,
        cart_total: cartTotal,
      })
    }

    // 5) Force-authorize + remap the cart's payment session(s) to the paid intent.
    //    Shared with the Airwallex webhook safety-net so both paths behave identically.
    await forceAuthorizeCartSessions(pool, cartId, intentId)

    // 6) Run Medusa's cart completion workflow
    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result: any = await completeCartWorkflow(req.scope).run({
      input: { id: cartId },
    })
    const orderId =
      result?.result?.id || result?.result?.order?.id || result?.id || result?.order?.id || null

    if (!orderId) {
      logger.error(
        `[Safety-net Replay] completeCartWorkflow returned no order id for cart ${cartId}: ${JSON.stringify(result).slice(0, 300)}`
      )
      return res.status(500).json({ error: "completeCartWorkflow returned no order id", result })
    }

    // 7) Enrich order metadata with Airwallex IDs (so webhooks and admin UI find it)
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
      completed_by: "admin_safety_net_replay",
      safety_net_completed_at: new Date().toISOString(),
    }
    await pool.query(
      `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedMeta), orderId]
    )

    logger.info(
      `[Safety-net Replay] ✅ Completed cart ${cartId} → order ${orderId} (intent ${intentId}, ${paidAmount} ${cart.currency_code})`
    )

    return res.json({
      order_id: orderId,
      cart_id: cartId,
      intent_id: intentId,
      paid_amount: paidAmount,
      currency: cart.currency_code,
      cleaned,
    })
  } catch (err: any) {
    logger.error(`[Safety-net Replay] Failed for cart ${cartId}: ${err.message}\n${err.stack}`)
    return res.status(500).json({ error: err.message })
  } finally {
    await pool.end().catch(() => {})
  }
}
