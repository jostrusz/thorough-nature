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
 * instead of relying on the final state of the session." So when the customer
 * returns from the bank, the frontend asks here: is the money in? If yes → show
 * the thank-you flow; if the transaction failed → show the error flow.
 *
 * Response: { paid, session_state, transaction_state, error_code }
 *   paid       = transaction in 4/5/6 (completed/credit/settled) OR session 12 (completed)
 *   error_code = Brite abort/fail reason (e.g. bank_rejected_transaction) when present
 *
 * Public (store middleware handles the publishable API key). cart_id is the only
 * input — we resolve the Brite session id from the cart's payment_session.data.
 *
 * NOTE: the storefront return handler POLLS this (≈1 call / 2s, up to ~10×), so the
 * Brite access_token is cached in-process (Brite tokens are valid 6h — we refresh
 * after 5h). Without the cache every poll would re-run merchant.authorize.
 */

// In-process token cache, keyed by api_key. Brite access_token TTL is 6h; refresh at 5h.
const TOKEN_CACHE: Record<string, { token: string; expiresAt: number }> = {}
const TOKEN_TTL_MS = 5 * 60 * 60 * 1000

async function getBriteToken(base: string, apiKey: string, secretKey: string): Promise<string | null> {
  // Key by base+apiKey: a token is bound to its environment (sandbox vs production),
  // so caching by apiKey alone could return a token issued against the other env.
  const cacheKey = `${base}|${apiKey}`
  const cached = TOKEN_CACHE[cacheKey]
  if (cached && cached.expiresAt > Date.now()) return cached.token
  const authR = await fetch(`${base}/api/merchant.authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ public_key: apiKey, secret: secretKey }),
  })
  const authD = await authR.json()
  const token = authD?.access_token || authD?.token
  if (!token) return null
  TOKEN_CACHE[cacheKey] = { token, expiresAt: Date.now() + TOKEN_TTL_MS }
  return token
}

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
      return res.json({ paid: false, session_state: null, transaction_state: null, error_code: null, reason: "no_brite_session" })
    }

    // 2) Brite credentials (active gateway, mode-aware).
    const { rows: gw } = await pool.query(
      `SELECT mode, live_keys, test_keys FROM gateway_config
       WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    if (!gw[0]) return res.json({ paid: false, session_state: null, transaction_state: null, error_code: null, reason: "no_gateway" })
    const live = gw[0].mode === "live"
    const keys = live ? gw[0].live_keys : gw[0].test_keys
    const base = live ? "https://production.britepaymentgroup.com" : "https://sandbox.britepaymentgroup.com"
    if (!keys?.api_key || !keys?.secret_key) {
      return res.json({ paid: false, session_state: null, transaction_state: null, error_code: null, reason: "no_keys" })
    }

    // 3) Authorize (cached token — this endpoint is polled).
    const token = await getBriteToken(base, keys.api_key, keys.secret_key)
    if (!token) return res.json({ paid: false, session_state: null, transaction_state: null, error_code: null, reason: "auth_failed" })

    // 4) session.get → session state + transaction id (+ error_code if aborted/failed).
    let sessionState: number | null = null
    let transactionId = txIdStored
    let errorCode: string | null = null
    try {
      const sR = await fetch(`${base}/api/session.get`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ id: sessionId }),
      })
      const sD = await sR.json()
      if (typeof sD?.state === "number") sessionState = sD.state
      if (sD?.transaction_id) transactionId = sD.transaction_id
      if (sD?.error_code) errorCode = sD.error_code
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
        if (tD?.error_code) errorCode = tD.error_code
      } catch { /* keep nulls */ }
    }

    const paid = sessionState === 12 || [4, 5, 6].includes(Number(transactionState))
    // Don't surface an abort error_code on a paid order: a late-settled session can read
    // ABORTED (error_code set) while the transaction is SETTLED → paid=true. Returning the
    // stale error_code could make a consumer show an error for a successful payment.
    return res.json({ paid, session_state: sessionState, transaction_state: transactionState, error_code: paid ? null : errorCode })
  } catch (error: any) {
    return res.status(500).json({ paid: false, error: error.message })
  } finally {
    await pool.end().catch(() => {})
  }
}
