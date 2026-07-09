// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reconcileSingleCart } from "../../../modules/payment-bank-transfer/reconcile"

/**
 * GET /store/bank-transfer-status?cart_id=xxx
 *
 * Polling endpoint for the bank-transfer "waiting for payment" popup (cart-first).
 * 1) If the cart is already completed (order created by reconcile) → paid:true.
 * 2) Otherwise runs an ON-DEMAND Revolut check for this cart (shared 15 s cache);
 *    on a match it completes the cart → creates the paid order → paid:true.
 * Public (publishable key), read-only-ish (only ever completes a matching cart).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const cartId = req.query.cart_id as string
    if (!cartId) { res.json({ paid: false, awaiting: false }); return }

    const { Pool } = require("pg")
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    let completedAt: any = null
    try {
      const { rows } = await pool.query(`SELECT completed_at FROM cart WHERE id = $1 LIMIT 1`, [cartId])
      completedAt = rows[0]?.completed_at || null
    } finally { await pool.end().catch(() => {}) }

    if (completedAt) { res.json({ paid: true, awaiting: false }); return }

    // On-demand reconcile for this cart.
    try {
      const logger = req.scope.resolve("logger")
      const orderId = await reconcileSingleCart(cartId, req.scope, logger)
      res.json({ paid: !!orderId, awaiting: !orderId })
      return
    } catch {
      res.json({ paid: false, awaiting: true })
    }
  } catch (error: any) {
    res.status(200).json({ paid: false, awaiting: true, error: error.message })
  }
}
