// @ts-nocheck
import { forceAuthorizeBriteCartSession } from "./force-authorize"

/**
 * Recover a Brite-paid-but-orderless cart into a real order.
 *
 * Shared by the brite-settled-reconcile cron (automatic, late settlements) and
 * the /admin/brite-recover endpoint (manual). The webhook safety-net keeps its
 * own copy (it has a 30s delay + ntfy alerting); this is the leaner, synchronous
 * path for cron/admin.
 *
 * Steps:
 *   1) cart must exist + be uncompleted
 *   2) no order may already cover this session/transaction (idempotent)
 *   3) cart total must equal the paid amount (within €0.02)
 *   4) force-authorize the Brite session onto the settled session/transaction
 *   5) completeCartWorkflow (authorizePayment confirms via late-settlement fallback)
 *   6) stamp Brite ids on order.metadata
 *
 * Safe by construction: callers pass a transaction already confirmed SETTLED/
 * CREDIT/COMPLETED at Brite.
 *
 * @returns { status, order_id?, reason?, cart_total? }
 *   status: "created" | "already_exists" | "no_cart" | "amount_mismatch" | "error"
 */
export async function recoverBriteCart(
  scope: any,
  opts: {
    cartId?: string
    briteSessionId: string
    briteTransactionId?: string | null
    paidAmount: number
    currency?: string
    paymentMethod?: string
    logger?: any
  }
): Promise<{ status: string; order_id?: string; reason?: string; cart_total?: number }> {
  const logger = opts.logger || console
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    const keys = [opts.briteSessionId, opts.briteTransactionId].filter(Boolean).map(String)

    // 2) Idempotency — order already covering this session/transaction?
    const dup = await pool.query(
      `SELECT o.display_id, o.id FROM "order" o
       LEFT JOIN order_payment_collection opc ON opc.order_id = o.id
       LEFT JOIN payment_collection pc ON pc.id = opc.payment_collection_id
       LEFT JOIN payment_session ps ON ps.payment_collection_id = pc.id
       WHERE EXISTS (SELECT 1 FROM unnest($1::text[]) k WHERE ps.data::text LIKE '%' || k || '%')
       LIMIT 1`,
      [keys]
    )
    if (dup.rows[0]) {
      return { status: "already_exists", order_id: dup.rows[0].id }
    }

    // 1) Resolve cart: explicit cartId, else find an uncompleted cart whose Brite
    //    session.data carries one of the keys.
    let cartId = opts.cartId || null
    if (!cartId) {
      const { rows } = await pool.query(
        `SELECT c.id
         FROM cart c
         JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
         JOIN payment_session ps ON ps.payment_collection_id = cpc.payment_collection_id
         WHERE EXISTS (SELECT 1 FROM unnest($1::text[]) k WHERE ps.data::text LIKE '%' || k || '%')
           AND c.completed_at IS NULL
         ORDER BY c.created_at DESC LIMIT 1`,
        [keys]
      )
      cartId = rows[0]?.id || null
    }
    if (!cartId) return { status: "no_cart" }

    // Cart must be uncompleted
    const cartRes = await pool.query(`SELECT completed_at FROM cart WHERE id = $1 LIMIT 1`, [cartId])
    if (!cartRes.rows[0]) return { status: "no_cart" }
    if (cartRes.rows[0].completed_at) return { status: "already_exists", reason: "cart_completed" }

    // 3) Amount validation
    const totalRes = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(quantity * unit_price) FROM cart_line_item
                   WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric
       + COALESCE((SELECT SUM(amount) FROM cart_shipping_method
                   WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS total`,
      [cartId]
    )
    const cartTotal = Number(totalRes.rows[0].total)
    if (opts.paidAmount > 0 && Math.abs(cartTotal - opts.paidAmount) > 0.02) {
      logger.warn?.(`[Brite Recover] Amount mismatch cart ${cartId}: cart ${cartTotal} vs paid ${opts.paidAmount}`)
      return { status: "amount_mismatch", cart_total: cartTotal }
    }

    // 4) Force-authorize onto the settled session/transaction
    await forceAuthorizeBriteCartSession(pool, cartId, opts.briteSessionId, opts.briteTransactionId || null)

    // 5) Complete the cart
    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result: any = await completeCartWorkflow(scope).run({ input: { id: cartId } })
    const orderId =
      result?.result?.id || result?.result?.order?.id || result?.id || result?.order?.id || null
    if (!orderId) return { status: "error", reason: "no_order_id" }

    // 6) Stamp Brite ids + recovery marker
    try {
      const metaRes = await pool.query(`SELECT metadata FROM "order" WHERE id = $1`, [orderId])
      const existing = metaRes.rows[0]?.metadata || {}
      const updated = {
        ...existing,
        payment_provider: "brite",
        payment_method: opts.paymentMethod || existing.payment_method || "pay_by_bank",
        briteSessionId: opts.briteSessionId,
        briteTransactionId: opts.briteTransactionId || existing.briteTransactionId || null,
        brite_credit_received: true,
        payment_captured: true,
        completed_by: "brite_settled_recover",
        recover_completed_at: new Date().toISOString(),
      }
      await pool.query(
        `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(updated), orderId]
      )
    } catch (e: any) {
      logger.warn?.(`[Brite Recover] metadata stamp failed for ${orderId}: ${e?.message}`)
    }

    logger.info?.(`[Brite Recover] ✅ cart ${cartId} → order ${orderId} (session ${opts.briteSessionId})`)
    return { status: "created", order_id: orderId }
  } catch (err: any) {
    logger.error?.(`[Brite Recover] Failed: ${err?.message}`)
    return { status: "error", reason: err?.message }
  } finally {
    await pool.end().catch(() => {})
  }
}
