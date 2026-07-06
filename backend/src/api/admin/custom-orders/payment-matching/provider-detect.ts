// @ts-nocheck
/**
 * Shared payment-gateway detection + payment-ID extraction for the Payment Matcher.
 *
 * SINGLE SOURCE OF TRUTH — imported by both route.ts (matcher table) and
 * export/route.ts (CSV export) so the two never drift apart again.
 *
 * Covers every gateway configured in gateway_config:
 *   airwallex, stripe, paypal, klarna, comgate, mollie, przelewy24, novalnet,
 *   payu, brite, barion, revolut, cod.
 *
 * When adding a new gateway, add its metadata ID field(s) to extractPaymentId +
 * extractPaymentIdFromPaymentData, and its provider/provider_id to
 * detectPaymentGateway. That's the only place.
 */

/**
 * Extract the primary payment/transaction ID from ORDER METADATA
 * (set by the order-placed-payment-metadata subscriber).
 */
export function extractPaymentId(meta: any): string | null {
  return (
    meta?.payment_id_override ||
    meta?.molliePaymentId ||
    meta?.stripePaymentIntentId ||
    meta?.paypalOrderId ||
    meta?.comgateTransId ||
    meta?.p24SessionId ||
    meta?.airwallexPaymentIntentId ||
    meta?.klarnaOrderId ||
    meta?.novalnetTid ||
    // Newer gateways
    meta?.payuOrderId || meta?.payu_order_id ||
    meta?.briteSessionId || meta?.brite_session_id || meta?.payment_brite_session_id ||
    meta?.barionPaymentId ||
    meta?.revolutOrderId || meta?.payment_revolut_order_id || meta?.revolut_transaction_id ||
    meta?.payment_id ||
    null
  )
}

/**
 * Fallback: extract a payment ID from a payment_collections payment.data blob,
 * for orders whose metadata lacks the ID (older orders / edge cases).
 */
export function extractPaymentIdFromPaymentData(data: any): string | null {
  if (!data) return null
  return (
    data.stripePaymentIntentId ||
    data.stripeCheckoutSessionId ||
    data.captureId ||               // PayPal capture reference
    data.payuOrderId ||             // PayU
    data.briteSessionId ||          // Brite
    data.barionPaymentId ||         // Barion
    data.revolutOrderId ||          // Revolut
    data.intentId ||                // Airwallex / Barion intent
    data.airwallexPaymentIntentId ||
    data.klarnaOrderId ||
    data.paypalOrderId ||
    data.comgateTransId ||
    data.molliePaymentId ||
    data.novalnetTid || data.tid ||
    data.id ||
    data.payment_intent ||
    null
  )
}

/** COD detection (metadata + payment_collections provider_id). */
export function isCodOrder(order: any): boolean {
  const meta = order?.metadata || {}
  if (meta.payment_provider === "cod" || meta.payment_method === "cod") return true
  const pcs = order?.payment_collections || []
  return pcs.some((pc: any) =>
    (pc.payments || []).some((p: any) => (p.provider_id || "").includes("cod"))
  )
}

/**
 * Detect the payment GATEWAY (brána) for an order.
 * Priority: COD → explicit metadata provider → metadata ID keys →
 *           payment_collections provider_id → Payment-ID pattern (legacy).
 * Returns one of: airwallex | stripe | paypal | klarna | comgate | mollie |
 *   przelewy24 | novalnet | payu | brite | barion | revolut | cod | unknown
 */
export function detectPaymentGateway(order: any, paymentId: string | null, isCod: boolean): string {
  if (isCod) return "cod"
  const meta = order?.metadata || {}

  // 1. Explicit provider set by subscriber
  const explicit = (meta.payment_provider || "").toString().toLowerCase()
  const explicitMap: Record<string, string> = {
    airwallex: "airwallex", stripe: "stripe", paypal: "paypal", klarna: "klarna",
    comgate: "comgate", mollie: "mollie", przelewy24: "przelewy24", p24: "przelewy24",
    novalnet: "novalnet", payu: "payu", brite: "brite", barion: "barion",
    revolut: "revolut", cod: "cod",
  }
  if (explicitMap[explicit]) return explicitMap[explicit]

  // 2. Metadata ID keys set by subscriber
  if (meta.airwallexPaymentIntentId) return "airwallex"
  if (meta.stripePaymentIntentId || meta.stripeCheckoutSessionId) return "stripe"
  if (meta.paypalOrderId) return "paypal"
  if (meta.klarnaOrderId) return "klarna"
  if (meta.comgateTransId) return "comgate"
  if (meta.molliePaymentId || meta.mollieOrderId) return "mollie"
  if (meta.p24SessionId) return "przelewy24"
  if (meta.novalnetTid) return "novalnet"
  if (meta.payuOrderId || meta.payu_order_id) return "payu"
  if (meta.briteSessionId || meta.brite_session_id || meta.payment_brite_session_id) return "brite"
  if (meta.barionPaymentId) return "barion"
  if (meta.revolutOrderId || meta.payment_revolut_order_id || meta.revolut_transaction_id) return "revolut"

  // 3. Payment collection provider_id
  const pcs = order?.payment_collections || []
  for (const pc of pcs) {
    for (const p of pc.payments || []) {
      const pid = (p.provider_id || "").toLowerCase()
      if (pid.includes("airwallex")) return "airwallex"
      if (pid.includes("stripe")) return "stripe"
      if (pid.includes("paypal")) return "paypal"
      if (pid.includes("klarna")) return "klarna"
      if (pid.includes("comgate")) return "comgate"
      if (pid.includes("mollie")) return "mollie"
      if (pid.includes("przelewy") || pid.includes("p24")) return "przelewy24"
      if (pid.includes("novalnet")) return "novalnet"
      if (pid.includes("payu")) return "payu"
      if (pid.includes("brite")) return "brite"
      if (pid.includes("barion")) return "barion"
      if (pid.includes("revolut")) return "revolut"
    }
  }

  // 4. Pattern-based fallback on the Payment ID (legacy orders without metadata)
  if (paymentId) {
    if (/^int_/i.test(paymentId)) return "airwallex"
    if (/^(pi|pm|cs|ch|py)_/i.test(paymentId)) return "stripe"
    if (/^tr_|^ord_/i.test(paymentId)) return "mollie"
    if (/^P24/i.test(paymentId)) return "przelewy24"
    // Klarna: UUID v4-ish format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId)) return "klarna"
    // PayPal capture: 17 uppercase alphanumeric chars
    if (/^[A-Z0-9]{17}$/.test(paymentId)) return "paypal"
    // Novalnet TID: exactly 17 digits (must come BEFORE Comgate's \d{6,12} check)
    if (/^\d{17}$/.test(paymentId)) return "novalnet"
    // Barion: 32 hex chars, no dashes
    if (/^[0-9a-f]{32}$/i.test(paymentId)) return "barion"
    // Comgate: short alphanumeric code with dashes or pure numeric
    if (/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(paymentId)) return "comgate"
    if (/^\d{6,12}$/.test(paymentId)) return "comgate"
  }

  return "unknown"
}
