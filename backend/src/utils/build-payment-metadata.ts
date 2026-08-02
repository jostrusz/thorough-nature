// @ts-nocheck
import { getSharedPgPool } from "./pg-pool"

/**
 * Map a gateway payment record onto the order-metadata fields the rest of the
 * system reads (admin, webhooks, payment-matcher export, invoicing).
 *
 * Extracted from order-placed-payment-metadata.ts so the live subscriber and the
 * historical backfill (scripts/backfill-payment-metadata.ts) cannot drift apart.
 * Branch order and key names are unchanged — the whole point is that a July order
 * repaired today ends up byte-identical to one written by the subscriber now.
 *
 * First matching payment wins, same as before.
 */
export async function buildPaymentMetadata(
  payments: any[]
): Promise<{ found: boolean; metadata: Record<string, any> }> {
  const newMetadata: any = {}

  for (const payment of payments || []) {
    const paymentData = payment?.data || {}
    const providerId = payment?.provider_id || ""

    // Mollie
    if (paymentData.molliePaymentId) {
      newMetadata.molliePaymentId = paymentData.molliePaymentId
      newMetadata.payment_method = paymentData.method || null
      newMetadata.payment_provider = "mollie"
      return { found: true, metadata: newMetadata }
    }
    if (paymentData.mollieOrderId) {
      newMetadata.mollieOrderId = paymentData.mollieOrderId
      newMetadata.payment_method = paymentData.method || null
      newMetadata.payment_provider = "mollie"
      return { found: true, metadata: newMetadata }
    }

    // Klarna
    if (paymentData.klarnaOrderId) {
      newMetadata.klarnaOrderId = paymentData.klarnaOrderId
      newMetadata.payment_klarna_order_id = paymentData.klarnaOrderId
      if (paymentData.sessionId) {
        newMetadata.payment_klarna_session_id = paymentData.sessionId
      }
      newMetadata.payment_method = "klarna"
      newMetadata.payment_provider = "klarna"
      return { found: true, metadata: newMetadata }
    }

    // PayPal
    if (paymentData.paypalOrderId || (providerId.includes("paypal") && paymentData.id)) {
      const paypalOrderId = paymentData.paypalOrderId || paymentData.orderID || paymentData.id
      if (paypalOrderId) {
        newMetadata.paypalOrderId = paypalOrderId
        newMetadata.payment_paypal_order_id = paypalOrderId
      }
      if (paymentData.authorizationId) {
        newMetadata.payment_paypal_authorization_id = paymentData.authorizationId
      }
      if (paymentData.captureId) {
        newMetadata.payment_paypal_capture_id = paymentData.captureId
      }
      newMetadata.payment_method = "paypal"
      newMetadata.payment_provider = "paypal"
      return { found: true, metadata: newMetadata }
    }

    // Comgate
    if (paymentData.comgateTransId) {
      newMetadata.comgateTransId = paymentData.comgateTransId
      newMetadata.payment_provider = "comgate"
      newMetadata.payment_method = paymentData.method || "comgate"
      return { found: true, metadata: newMetadata }
    }

    // Przelewy24
    if (paymentData.p24SessionId || paymentData.p24Token || providerId.includes("przelewy24")) {
      if (paymentData.p24SessionId || paymentData.sessionId) {
        newMetadata.p24SessionId = paymentData.p24SessionId || paymentData.sessionId
      }
      if (paymentData.p24Token) newMetadata.p24Token = paymentData.p24Token
      if (paymentData.p24OrderId) newMetadata.p24OrderId = paymentData.p24OrderId
      if (paymentData.p24MethodId) newMetadata.p24MethodId = paymentData.p24MethodId
      newMetadata.payment_method = paymentData.method || "przelewy24"
      newMetadata.payment_provider = "przelewy24"
      return { found: true, metadata: newMetadata }
    }

    // Airwallex
    if (paymentData.airwallexPaymentIntentId || (providerId.includes("airwallex") && paymentData.intentId)) {
      newMetadata.airwallexPaymentIntentId =
        paymentData.airwallexPaymentIntentId || paymentData.intentId
      newMetadata.payment_method = paymentData.method || "airwallex"
      newMetadata.payment_provider = "airwallex"
      return { found: true, metadata: newMetadata }
    }

    // Barion
    if (paymentData.barionPaymentId || (providerId.includes("barion") && paymentData.intentId)) {
      newMetadata.barionPaymentId = paymentData.barionPaymentId || paymentData.intentId
      newMetadata.payment_method = paymentData.method || "barion"
      newMetadata.payment_provider = "barion"
      return { found: true, metadata: newMetadata }
    }

    // Stripe
    if (paymentData.stripePaymentIntentId || paymentData.stripeCheckoutSessionId || (providerId.includes("stripe") && paymentData.id)) {
      newMetadata.stripePaymentIntentId = paymentData.stripePaymentIntentId || paymentData.id
      if (paymentData.stripeCheckoutSessionId) {
        newMetadata.stripeCheckoutSessionId = paymentData.stripeCheckoutSessionId
      }
      newMetadata.payment_method = paymentData.method || "card"
      newMetadata.payment_provider = "stripe"
      return { found: true, metadata: newMetadata }
    }

    // Revolut (Pay by Bank)
    if (paymentData.revolutOrderId || (providerId.includes("revolut") && paymentData.id)) {
      const revolutOrderId = paymentData.revolutOrderId || paymentData.id
      if (revolutOrderId) {
        newMetadata.revolutOrderId = revolutOrderId
        newMetadata.payment_revolut_order_id = revolutOrderId
      }
      newMetadata.payment_method = paymentData.method || "pay_by_bank"
      newMetadata.payment_provider = "revolut"
      return { found: true, metadata: newMetadata }
    }

    // PayU
    if (paymentData.payuOrderId || (providerId.includes("payu") && (paymentData.payuOrderId || paymentData.extOrderId))) {
      if (paymentData.payuOrderId) {
        newMetadata.payu_order_id = paymentData.payuOrderId
        newMetadata.payuOrderId = paymentData.payuOrderId
      }
      if (paymentData.extOrderId) {
        newMetadata.payu_ext_order_id = paymentData.extOrderId
      }
      newMetadata.payment_method = paymentData.method || "payu"
      newMetadata.payment_provider = "payu"
      return { found: true, metadata: newMetadata }
    }

    // Brite (Pay by Bank)
    if (paymentData.briteSessionId || (providerId.includes("brite") && paymentData.intentId)) {
      const briteSessionId = paymentData.briteSessionId || paymentData.intentId
      if (briteSessionId) {
        newMetadata.briteSessionId = briteSessionId
        newMetadata.brite_session_id = briteSessionId
        newMetadata.payment_brite_session_id = briteSessionId
      }
      if (paymentData.merchant_reference) {
        newMetadata.brite_merchant_reference = paymentData.merchant_reference
      }
      if (paymentData.preselected_bank) {
        newMetadata.payment_brite_bank_id = paymentData.preselected_bank
        // Human bank name from the cached list — best effort, uses the shared pool
        // (the original opened a fresh Pool per order, which a backfill cannot afford).
        try {
          const { rows } = await getSharedPgPool().query(
            `SELECT name FROM brite_bank_logo
              WHERE bank_id = $1 AND name IS NOT NULL
              ORDER BY updated_at DESC LIMIT 1`,
            [paymentData.preselected_bank]
          )
          if (rows[0]?.name) newMetadata.payment_brite_bank_name = rows[0].name
        } catch { /* non-critical */ }
      }
      newMetadata.payment_method = paymentData.method || "pay_by_bank"
      newMetadata.payment_provider = "brite"
      return { found: true, metadata: newMetadata }
    }

    // Novalnet
    if (paymentData.novalnetTid || paymentData.tid || providerId.includes("novalnet")) {
      const tid = paymentData.novalnetTid || paymentData.tid
      if (tid) newMetadata.novalnetTid = String(tid)
      newMetadata.payment_method = paymentData.method || paymentData.payment_type || "novalnet"
      newMetadata.payment_provider = "novalnet"
      return { found: true, metadata: newMetadata }
    }

    // COD
    if (providerId.includes("cod") || paymentData.method === "cod") {
      newMetadata.payment_method = "cod"
      newMetadata.payment_provider = "cod"
      return { found: true, metadata: newMetadata }
    }

    // Generic Klarna fallback
    // NOTE — one deliberate change from the original: payment_provider is now set
    // here too. The old branch set only payment_method, so these orders reached the
    // payment-matcher export with no gateway and were counted as "unknown".
    if (providerId.includes("klarna") && paymentData.sessionId) {
      newMetadata.klarnaOrderId = paymentData.klarnaOrderId || null
      newMetadata.payment_klarna_session_id = paymentData.sessionId
      newMetadata.payment_method = "klarna"
      newMetadata.payment_provider = "klarna"
      return { found: true, metadata: newMetadata }
    }
  }

  return { found: false, metadata: newMetadata }
}
