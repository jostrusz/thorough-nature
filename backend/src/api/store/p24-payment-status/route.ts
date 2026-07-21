// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import {
  Przelewy24ApiClient,
  credsFromGatewayConfig,
  pickP24Config,
} from "../../../modules/payment-przelewy24/api-client"

/**
 * GET /store/p24-payment-status?cart_id=cart_123
 *
 * Polled by the checkout while the customer confirms a BLIK level-0 payment in
 * their banking app. Answers one question: did the money arrive?
 *
 * Two independent signals, either of which is enough:
 *   1. `p24_verified` on the payment session — written by /webhooks/przelewy24
 *      after it ran the mandatory /transaction/verify. Authoritative.
 *   2. GET /transaction/by/sessionId — status 2 (paid & verified) or 1 (advance).
 *      Used as a fallback when the webhook is still in flight.
 *
 * P24 returns "Transaction not found" for a registered-but-unpaid transaction,
 * which is the normal state while the customer is still tapping in the app — so
 * that is reported as pending, not as an error.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const cartId = String(req.query.cart_id || "")
  if (!cartId) return res.status(400).json({ error: "cart_id is required" })

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    const { rows } = await pool.query(
      `SELECT ps.data
       FROM payment_session ps
       JOIN cart_payment_collection cpc ON cpc.payment_collection_id = ps.payment_collection_id
       WHERE cpc.cart_id = $1 AND ps.provider_id LIKE 'pp_przelewy24%'
       ORDER BY ps.created_at DESC LIMIT 1`,
      [cartId]
    )
    const data = rows[0]?.data || {}
    const sessionId = data.p24SessionId || data.sessionId || null
    if (!sessionId) {
      return res.json({ paid: false, status: null, reason: "no_p24_session" })
    }

    // Webhook already verified → done, no need to call P24.
    if (data.p24_verified) {
      return res.json({ paid: true, status: 2, source: "webhook" })
    }

    const { rows: gwRows } = await pool.query(
      `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority
       FROM gateway_config
       WHERE provider = 'przelewy24' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    const config = pickP24Config(gwRows, data.project_slug || null)
    const creds = credsFromGatewayConfig(config)
    if (!creds) return res.json({ paid: false, status: null, reason: "no_gateway" })

    const client = new Przelewy24ApiClient(creds)
    const tx = await client.getTransactionBySessionId(sessionId)
    if (!tx.success) {
      // Not found yet = customer hasn't confirmed in the app. Still pending.
      return res.json({ paid: false, status: null, source: "api", reason: "pending" })
    }

    const status = Number(tx.data?.status ?? 0)
    return res.json({
      paid: status === 2 || status === 1,
      status,
      order_id: tx.data?.orderId ?? null,
      source: "api",
    })
  } catch (e: any) {
    console.error("[P24 status] error:", e.message)
    return res.status(500).json({ paid: false, error: e.message })
  } finally {
    await pool.end().catch(() => {})
  }
}
