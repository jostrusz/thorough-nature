// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import {
  Przelewy24ApiClient,
  credsFromGatewayConfig,
  pickP24Config,
} from "../../../modules/payment-przelewy24/api-client"
import { logPaymentEvent } from "../../../modules/payment-debug/utils/log"

/**
 * POST /store/p24-blik-charge  { cart_id, blik_code }
 *
 * BLIK level 0 — the customer typed the 6-digit code straight into our checkout.
 * We charge the already-registered P24 transaction with it; P24 then pushes a
 * confirmation prompt to their banking app. Nobody leaves the site.
 *
 * The actual money movement is confirmed asynchronously: the customer taps
 * "confirm" in the app, P24 posts the status notification to
 * /webhooks/przelewy24, which runs the mandatory /transaction/verify. The
 * storefront meanwhile polls /store/p24-payment-status.
 *
 * So a 200 here means ONLY "code accepted, prompt sent" — never "paid".
 *
 * Error codes seen from P24 (probed against the live merchant):
 *   98  — rejected by validation (code not 6 digits)
 *  103  — accepted by us, rejected by BLIK (wrong / expired / unknown code)
 * Both are surfaced as `retryable: true` so the checkout can let the customer
 * type a fresh code instead of dead-ending.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) || {}
  const cartId = String(body.cart_id || "")
  const blikCode = String(body.blik_code || "").replace(/\D/g, "")

  if (!cartId) return res.status(400).json({ error: "cart_id is required" })
  if (blikCode.length !== 6) {
    return res.status(400).json({
      error: "blik_code must be exactly 6 digits",
      code: 98,
      retryable: true,
    })
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // 1) The P24 token registered for this cart (initiatePayment stored it).
    const { rows } = await pool.query(
      `SELECT ps.data
       FROM payment_session ps
       JOIN cart_payment_collection cpc ON cpc.payment_collection_id = ps.payment_collection_id
       WHERE cpc.cart_id = $1 AND ps.provider_id LIKE 'pp_przelewy24%'
       ORDER BY ps.created_at DESC LIMIT 1`,
      [cartId]
    )
    const data = rows[0]?.data || {}
    const token = data.p24Token || null
    if (!token) {
      return res.status(404).json({ error: "No Przelewy24 session for this cart", retryable: false })
    }
    if (!data.blikInline) {
      // Registered without PSU → P24 will refuse the charge. Tell the storefront
      // to fall back to the hosted page rather than burn the customer's code.
      return res.status(409).json({
        error: "This session was not registered for inline BLIK",
        redirect_url: data.checkoutUrl || null,
        retryable: false,
      })
    }

    // 2) Credentials for this project's gateway.
    const { rows: gwRows } = await pool.query(
      `SELECT id, display_name, mode, live_keys, test_keys, project_slugs, priority
       FROM gateway_config
       WHERE provider = 'przelewy24' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC`
    )
    const config = pickP24Config(gwRows, data.project_slug || null)
    const creds = credsFromGatewayConfig(config)
    if (!creds) {
      return res.status(500).json({ error: "Przelewy24 gateway not configured", retryable: false })
    }

    logPaymentEvent({
      intent_id: data.p24SessionId || null,
      cart_id: cartId,
      email: data.email || null,
      project_slug: data.project_slug || null,
      event_type: "p24_blik_charge_request",
      event_data: { hasToken: true },
    })

    // 3) Charge. Never log the BLIK code itself — it is a payment credential.
    const client = new Przelewy24ApiClient(creds)
    const result = await client.chargeBlikByCode({ token, blikCode })

    logPaymentEvent({
      intent_id: data.p24SessionId || null,
      cart_id: cartId,
      email: data.email || null,
      project_slug: data.project_slug || null,
      event_type: "p24_blik_charge_response",
      event_data: { success: result.success, orderId: result.data?.orderId ?? null },
      error_code: result.success ? null : String(result.errorCode ?? "charge_failed"),
    })

    if (!result.success) {
      const code = Number(result.errorCode)
      // 98/103 → the code itself was refused; anything else is infrastructure.
      const retryable = code === 98 || code === 103
      return res.status(400).json({
        error: result.error || "BLIK charge failed",
        code: result.errorCode ?? null,
        retryable,
        redirect_url: retryable ? null : data.checkoutUrl || null,
      })
    }

    return res.json({
      accepted: true,
      order_id: result.data?.orderId ?? null,
      message: result.data?.message ?? null,
    })
  } catch (e: any) {
    console.error("[P24 BLIK charge] error:", e.message)
    return res.status(500).json({ error: e.message || "BLIK charge failed", retryable: false })
  } finally {
    await pool.end().catch(() => {})
  }
}
