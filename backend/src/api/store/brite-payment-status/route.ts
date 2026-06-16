// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"

/**
 * GET /store/brite-payment-status?cart_id=cart_123
 *
 * Tells the checkout whether a Brite payment for this cart has actually been
 * received — by TRANSACTION state, not session state.
 *
 * WHY: Brite docs (in-depth-knowledge-session-states) say the SESSION can read
 * ABORTED (10) while the TRANSACTION still settles (e.g. name_mismatch, late
 * settlement). "Subscribe to the transaction states for processing flow of funds
 * instead of relying on the final state of the session." So when the Web SDK ends
 * in aborted/closed, the frontend asks here: is the money in? If yes → show the
 * thank-you flow instead of an error.
 *
 * Response: { paid: boolean, session_state: number|null, transaction_state: number|null }
 *   paid = transaction in 4/5/6 (completed/credit/settled) OR session 12 (completed)
 *
 * Public (store middleware handles the publishable API key). cart_id is the only
 * input — we resolve the Brite session id from the cart's payment_session.data.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId = String(req.query.cart_id || "")
  if (!cartId) return res.status(400).json({ error: "cart_id is required" })

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // 1) Resolve the Brite session/transaction id stored on the cart's payment session.
    const { rows } = await pool.query(
      `SELECT ps.data
       FROM payment_session ps
       JOIN cart_payment_collection cpc ON cpc.payment_collection_id = ps.payment_collection_id
       WHERE cpc.cart_id = $1 AND ps.provider_id LIKE 'pp_brite%'
       ORDER BY ps.created_at DESC LIMIT 1`,
      [cartId]
    )
    const data = rows[0]?.data || {}
    const sessionId = data.briteSessionId || data.intentId || null
    const txIdStored = data.briteTransactionId || null
    if (!sessionId) {
      return res.json({ paid: false, session_state: null, transaction_state: null, reason: "no_brite_session" })
    }

    // 2) Brite credentials (active gateway, mode-aware).
    const { rows: gw } = await pool.query(
      `SELECT mode, live_keys, test_keys FROM gateway_config
       WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    if (!gw[0]) return res.json({ paid: false, session_state: null, transaction_state: null, reason: "no_gateway" })
    const live = gw[0].mode === "live"
    const keys = live ? gw[0].live_keys : gw[0].test_keys
    const base = live ? "https://production.britepaymentgroup.com" : "https://sandbox.britepaymentgroup.com"
    if (!keys?.api_key || !keys?.secret_key) {
      return res.json({ paid: false, session_state: null, transaction_state: null, reason: "no_keys" })
    }

    // 3) Authorize.
    const authR = await fetch(`${base}/api/merchant.authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: keys.api_key, secret: keys.secret_key }),
    })
    const authD = await authR.json()
    const token = authD?.access_token || authD?.token
    if (!token) return res.json({ paid: false, session_state: null, transaction_state: null, reason: "auth_failed" })

    // 4) session.get → session state + transaction id.
    let sessionState: number | null = null
    let transactionId = txIdStored
    try {
      const sR = await fetch(`${base}/api/session.get`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId }),
      })
      const sD = await sR.json()
      if (typeof sD?.state === "number") sessionState = sD.state
      if (sD?.transaction_id) transactionId = sD.transaction_id
    } catch { /* fall through to tx check */ }

    // 5) Session 12 = completed → paid. Otherwise check the TRANSACTION (late settlement).
    let transactionState: number | null = null
    if (sessionState !== 12 && transactionId) {
      try {
        const tR = await fetch(`${base}/api/transaction.get`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: transactionId }),
        })
        const tD = await tR.json()
        if (typeof tD?.state === "number") transactionState = tD.state
      } catch { /* keep nulls */ }
    }

    const paid = sessionState === 12 || [4, 5, 6].includes(Number(transactionState))
    return res.json({ paid, session_state: sessionState, transaction_state: transactionState })
  } catch (error: any) {
    return res.status(500).json({ paid: false, error: error.message })
  } finally {
    await pool.end().catch(() => {})
  }
}
