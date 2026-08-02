// @ts-nocheck
/**
 * Where each gateway keeps its payment/transaction ID.
 *
 * There were three independent copies of this list — the payment-matcher route,
 * the CSV export, and the order-detail admin panel — and they drifted: Revolut,
 * PayU, Brite and Barion were added to the first two but not to the panel, so a
 * Revolut order showed "Payment ID —" while `payment.data.revolutOrderId` was
 * sitting right there. One list now, imported by all of them.
 *
 * Adding a gateway = adding its keys here.
 */

/** Primary ID from ORDER METADATA (written by order-placed-payment-metadata). */
export function extractPaymentId(meta: any): string | null {
  if (!meta) return null
  return (
    meta.payment_id_override ||
    meta.molliePaymentId ||
    meta.mollieOrderId ||
    meta.stripePaymentIntentId ||
    meta.paypalOrderId ||
    meta.comgateTransId ||
    meta.p24SessionId ||
    meta.airwallexPaymentIntentId ||
    meta.klarnaOrderId ||
    meta.novalnetTid ||
    meta.payuOrderId || meta.payu_order_id ||
    meta.briteSessionId || meta.brite_session_id || meta.payment_brite_session_id ||
    meta.barionPaymentId ||
    meta.revolutOrderId || meta.payment_revolut_order_id || meta.revolut_transaction_id ||
    meta.payment_id ||
    null
  )
}

/** Fallback: ID straight from a payment_collections payment.data blob. */
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
    data.mollieOrderId ||
    data.novalnetTid || data.tid ||
    data.id ||
    data.payment_intent ||
    data.transaction_id ||
    null
  )
}
