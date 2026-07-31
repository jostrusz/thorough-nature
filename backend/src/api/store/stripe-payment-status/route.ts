// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import Stripe from "stripe"

/**
 * GET /store/stripe-payment-status?cart_id=cart_123
 *
 * Polled by the checkout while the customer authorises a Bizum payment in their
 * banking app. Bizum has no hosted redirect page — Stripe confirms the
 * PaymentIntent server-side and parks it on `requires_action` with
 * `next_action.type = "await_authorization"` until the customer taps approve.
 * There is no URL to send anyone to, so the only way to learn the outcome is to
 * ask Stripe (or wait for the webhook).
 *
 * Two independent signals, either is enough:
 *   1. `stripe_succeeded` on the payment session — written by /webhooks/stripe.
 *   2. PaymentIntent.status === "succeeded" straight from the Stripe API.
 *
 * `requires_action` is the normal state while the customer is still in the app,
 * so it is reported as pending, never as an error.
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
       WHERE cpc.cart_id = $1 AND ps.provider_id LIKE 'pp_stripe%'
       ORDER BY ps.created_at DESC LIMIT 1`,
      [cartId]
    )
    const data = rows[0]?.data || {}
    const intentId = data.stripePaymentIntentId || data.id || null
    if (!intentId) {
      return res.json({ paid: false, status: null, reason: "no_stripe_session" })
    }

    // Webhook already saw it succeed → done, no need to call Stripe.
    if (data.stripe_succeeded) {
      return res.json({ paid: true, status: "succeeded", source: "webhook" })
    }

    const { rows: gwRows } = await pool.query(
      `SELECT live_keys, test_keys, mode, project_slugs, priority
       FROM gateway_config
       WHERE provider = 'stripe' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    const slug = data.project_slug || null
    let gw =
      (slug &&
        gwRows.find(
          (r: any) => Array.isArray(r.project_slugs) && r.project_slugs.includes(slug)
        )) ||
      null
    if (!gw) gw = gwRows.find((r: any) => !r.project_slugs?.length) || gwRows[0]
    if (!gw) return res.json({ paid: false, status: null, reason: "no_gateway" })

    const keys = gw.mode === "test" ? gw.test_keys || {} : gw.live_keys || {}
    // `secret_key` on these rows holds the webhook secret (whsec_…) — the API key
    // lives in `api_key`. Prefer it and only fall back to a real sk_ value.
    const apiKey =
      keys.api_key ||
      (String(keys.secret_key || "").startsWith("sk_") ? keys.secret_key : null)
    if (!apiKey) return res.json({ paid: false, status: null, reason: "no_api_key" })

    const stripe = new Stripe(apiKey, { apiVersion: "2025-01-27.acacia" as any })
    const pi = await stripe.paymentIntents.retrieve(intentId)

    const status = pi.status
    return res.json({
      paid: status === "succeeded",
      // Terminal failure — the customer declined or it timed out in the app.
      failed: status === "canceled" || status === "requires_payment_method",
      status,
      next_action: pi.next_action?.type || null,
      source: "api",
    })
  } catch (e: any) {
    console.error("[Stripe status] error:", e.message)
    return res.status(500).json({ paid: false, error: e.message })
  } finally {
    await pool.end().catch(() => {})
  }
}
