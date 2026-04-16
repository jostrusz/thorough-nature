import { PaymentSessionStatus } from "@medusajs/framework/utils"

/**
 * Map Novalnet transaction status codes → Medusa PaymentSessionStatus.
 *
 * Reference: Novalnet API docs + Payum/WooCommerce SDK status handlers.
 *
 * Novalnet uses a numeric `status` (HTTP-like) AND a string `tx_status`.
 * Both can appear depending on endpoint — we handle both.
 */

/**
 * Status string codes used in `transaction.status` from /v2/transaction/details.
 */
const TX_STATUS_MAP: Record<string, PaymentSessionStatus> = {
  // Pending / awaiting payment
  PENDING: PaymentSessionStatus.PENDING,
  ON_HOLD: PaymentSessionStatus.AUTHORIZED,
  ON_VERIFICATION: PaymentSessionStatus.PENDING,

  // Confirmed / completed
  CONFIRMED: PaymentSessionStatus.CAPTURED,
  COMPLETED: PaymentSessionStatus.CAPTURED,

  // Failed / cancelled
  FAILED: PaymentSessionStatus.ERROR,
  DEACTIVATED: PaymentSessionStatus.CANCELED,
  CANCELED: PaymentSessionStatus.CANCELED,
  CANCELLED: PaymentSessionStatus.CANCELED,
}

/**
 * Numeric status codes used in `result.status` from /v2/payment.
 *   100 = success
 *   200 = success (alternative)
 *   anything else (or missing) = failure
 */
function mapNumericStatus(status: number | string): PaymentSessionStatus {
  const n = Number(status)
  if (n === 100 || n === 200) return PaymentSessionStatus.AUTHORIZED
  return PaymentSessionStatus.ERROR
}

/**
 * Universal status mapper — accepts any of the status fields Novalnet can return.
 * Priority: tx_status (string) → status (numeric) → fallback PENDING.
 */
export function mapNovalnetStatus(
  txStatus?: string | null,
  numericStatus?: number | string | null
): PaymentSessionStatus {
  if (txStatus) {
    const upper = String(txStatus).toUpperCase()
    if (TX_STATUS_MAP[upper]) return TX_STATUS_MAP[upper]
  }
  if (numericStatus !== undefined && numericStatus !== null) {
    return mapNumericStatus(numericStatus)
  }
  return PaymentSessionStatus.PENDING
}

/**
 * Translate Novalnet webhook event_type → Medusa webhook action.
 * The webhook handler returns this action; Medusa core then drives the
 * payment lifecycle (move session to authorized/captured/failed).
 *
 * Novalnet event types (from their notification docs):
 *   PAYMENT                    — initial successful payment
 *   TRANSACTION_CONFIRMATION   — payment confirmed (e.g. SEPA after pre-check)
 *   TRANSACTION_CAPTURE        — captured after on-hold
 *   TRANSACTION_CANCEL         — cancelled
 *   TRANSACTION_REFUND         — refunded
 *   CREDIT                     — credit (refund variant)
 *   CHARGEBACK                 — chargeback
 *   INSTALMENT                 — instalment cycle
 *   SUBSCRIPTION_*             — subscription events (not used in our flow)
 */
export function mapWebhookEventToAction(eventType: string, txStatus?: string): "authorized" | "captured" | "failed" | "not_supported" {
  const evt = (eventType || "").toUpperCase()

  if (evt === "PAYMENT" || evt === "TRANSACTION_CONFIRMATION" || evt === "TRANSACTION_CAPTURE") {
    // Map by status — confirmed/completed = captured, on_hold = authorized, etc.
    const mapped = mapNovalnetStatus(txStatus, null)
    if (mapped === PaymentSessionStatus.CAPTURED) return "captured"
    if (mapped === PaymentSessionStatus.AUTHORIZED) return "authorized"
    if (mapped === PaymentSessionStatus.ERROR || mapped === PaymentSessionStatus.CANCELED) return "failed"
    return "authorized" // default for PAYMENT events
  }

  if (evt === "TRANSACTION_CANCEL" || evt === "TRANSACTION_REFUND" || evt === "CREDIT" || evt === "CHARGEBACK") {
    return "failed"
  }

  return "not_supported"
}
