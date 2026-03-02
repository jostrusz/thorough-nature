import React from "react"
import { CheckCircleSolid, XCircleSolid, ArrowUpRightOnBox, ExclamationCircle } from "@medusajs/icons"
import { colors, shadows, radii, cardStyle, cardHeaderStyle, fontStack } from "./design-tokens"

interface PaymentActivityEntry {
  timestamp: string
  event: string
  gateway: string
  payment_method?: string
  status: "success" | "error" | "pending"
  amount?: number
  currency?: string
  transaction_id?: string
  refund_id?: string
  error_message?: string
  error_code?: string
  tracking_sent?: boolean
  tracking_number?: string
  tracking_carrier?: string
  detail?: string
}

interface OrderPaymentActivityProps {
  order: any
}

const GATEWAY_DISPLAY_NAMES: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  mollie: "Mollie",
  klarna: "Klarna",
  comgate: "Comgate",
  przelewy24: "Przelewy24",
  airwallex: "Airwallex",
  p24: "Przelewy24",
}

const METHOD_LABELS: Record<string, string> = {
  ideal: "iDEAL",
  creditcard: "Credit Card",
  bancontact: "Bancontact",
  klarnapaylater: "Klarna",
  klarna: "Klarna",
  paypal: "PayPal",
  applepay: "Apple Pay",
  googlepay: "Google Pay",
  eps: "EPS",
  przelewy24: "Przelewy24",
  p24: "Przelewy24",
  sepa_debit: "SEPA Direct Debit",
  revolut_pay: "Revolut Pay",
  card: "Card",
}

/**
 * Extract gateway name from provider_id like "pp_stripe_stripe" → "stripe"
 */
function extractGatewayName(providerId: string): string {
  return (providerId || "")
    .replace(/^pp_/, "")
    .split("_")[0]
    .toLowerCase()
}

/**
 * Extract payment method label from payment data
 */
function extractPaymentMethod(payment: any): string {
  const data = payment?.data || {}
  const raw =
    data.method ||
    data.payment_method ||
    data.resource?.method ||
    ""
  return METHOD_LABELS[raw] || raw || ""
}

/**
 * Extract gateway payment ID from payment data
 */
function extractGatewayPaymentId(payment: any): string {
  const data = payment?.data || {}
  return (
    data.molliePaymentId ||
    data.mollieOrderId ||
    data.stripePaymentIntentId ||
    data.stripeCheckoutSessionId ||
    data.paypalOrderId ||
    data.klarnaOrderId ||
    data.comgateTransId ||
    data.airwallexPaymentIntentId ||
    data.payment_intent ||
    data.id ||
    data.payment_id ||
    data.transaction_id ||
    ""
  )
}

/**
 * Build a synthetic "Payment Received" entry from the order's payment collections.
 * This ensures the initial payment is always visible in the activity log,
 * even if no explicit payment_activity_log entry was recorded.
 */
function buildReceivedEntry(order: any): PaymentActivityEntry | null {
  const payments = (order.payment_collections || []).flatMap(
    (pc: any) => pc.payments || []
  )
  if (!payments.length) return null

  const payment = payments[0]
  const gateway = extractGatewayName(payment.provider_id || "")
  const method = extractPaymentMethod(payment)
  const gatewayPaymentId = extractGatewayPaymentId(payment)
  const amount = Number(payment.amount) || Number(order.total) || 0
  const currency = order.currency_code || "eur"

  return {
    timestamp: payment.created_at || payment.captured_at || order.created_at,
    event: "received",
    gateway,
    payment_method: method,
    status: "success",
    amount,
    currency,
    transaction_id: gatewayPaymentId,
    detail: "Payment received",
  }
}

export const PaymentActivityLog: React.FC<OrderPaymentActivityProps> = ({
  order,
}) => {
  const activityLog = (order.metadata?.payment_activity_log ||
    []) as PaymentActivityEntry[]

  // Build synthetic "received" entry from payment data
  const receivedEntry = buildReceivedEntry(order)

  // Combine: activity log + synthetic received entry (if not already in log)
  const hasReceivedInLog = activityLog.some(
    (e) => e.event === "received" || e.event === "capture" || e.event === "authorization"
  )
  const combinedLog: PaymentActivityEntry[] = [
    ...activityLog,
    ...(!hasReceivedInLog && receivedEntry ? [receivedEntry] : []),
  ]

  if (combinedLog.length === 0) {
    return (
      <div style={{ ...cardStyle, padding: 24 }}>
        <h3 style={{ ...cardHeaderStyle, padding: 0, borderBottom: "none", marginBottom: 16, fontSize: 16 }}>
          Payment Activity
        </h3>
        <p style={{ fontSize: 14, color: colors.textSec, fontFamily: fontStack }}>No payment activity recorded.</p>
      </div>
    )
  }

  const sortedLog = [...combinedLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div style={{ ...cardStyle, padding: 24 }}>
      <h3 style={{ ...cardHeaderStyle, padding: 0, borderBottom: "none", marginBottom: 24, fontSize: 16 }}>
        Payment Activity
      </h3>

      <div>
        {sortedLog.map((entry, index) => (
          <PaymentActivityEntryRow
            key={`${entry.timestamp}-${index}`}
            entry={entry}
            isLast={index === sortedLog.length - 1}
          />
        ))}
      </div>
    </div>
  )
}

interface PaymentActivityEntryProps {
  entry: PaymentActivityEntry
  isLast: boolean
}

const PaymentActivityEntryRow: React.FC<PaymentActivityEntryProps> = ({
  entry,
  isLast,
}) => {
  const timestamp = new Date(entry.timestamp)
  const formattedTime = timestamp.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })

  const gatewayLabel = GATEWAY_DISPLAY_NAMES[entry.gateway] || entry.gateway || ""
  const methodLabel = entry.payment_method
    ? METHOD_LABELS[entry.payment_method] || entry.payment_method
    : ""
  const eventLabel = formatEventLabel(entry.event)

  const getStatusIcon = () => {
    if (entry.event === "tracking_sent") {
      return <ArrowUpRightOnBox style={{ width: 16, height: 16, color: colors.blue }} />
    }
    if (entry.status === "success") {
      return <CheckCircleSolid style={{ width: 16, height: 16, color: colors.green }} />
    }
    if (entry.status === "error") {
      return <XCircleSolid style={{ width: 16, height: 16, color: colors.red }} />
    }
    return <ExclamationCircle style={{ width: 16, height: 16, color: colors.yellow }} />
  }

  const getStatusBg = () => {
    if (entry.event === "tracking_sent") return colors.blueBg
    if (entry.status === "success") return colors.greenBg
    if (entry.status === "error") return colors.redBg
    return colors.yellowBg
  }

  // Amount display — handle both number and string formats
  const amountNum = entry.amount ? Number(entry.amount) : 0
  const hasCurrency = !!(entry.currency && amountNum > 0)

  return (
    <div style={{ position: "relative", display: "flex", gap: 16, paddingBottom: isLast ? 0 : 24 }}>
      {/* Timeline connector line */}
      {!isLast && (
        <div style={{
          position: "absolute",
          left: 15,
          top: 40,
          height: "calc(100% - 40px)",
          width: 2,
          background: colors.border,
        }} />
      )}

      {/* Status icon */}
      <div style={{ flexShrink: 0, position: "relative" }}>
        <div style={{
          display: "flex",
          height: 32,
          width: 32,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "50%",
          background: getStatusBg(),
        }}>
          {getStatusIcon()}
        </div>
      </div>

      {/* Content */}
      <div style={{ flexGrow: 1, paddingTop: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16 }}>
          <div>
            <p style={{ fontSize: 12, color: colors.textMuted, fontFamily: fontStack }}>{formattedTime}</p>
            <p style={{ fontSize: 14, fontWeight: 500, color: colors.text, marginTop: 4, fontFamily: fontStack }}>{eventLabel}</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            {/* Gateway pill */}
            {gatewayLabel && (
              <span style={{
                display: "inline-block",
                borderRadius: 9999,
                border: `1px solid ${colors.border}`,
                padding: "2px 12px",
                fontSize: 12,
                fontWeight: 500,
                color: colors.textSec,
                fontFamily: fontStack,
              }}>
                {gatewayLabel}
              </span>
            )}

            {/* Amount */}
            {hasCurrency && (
              <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, fontFamily: fontStack }}>
                {formatCurrency(amountNum, entry.currency!)}
              </span>
            )}
          </div>
        </div>

        {/* Details section */}
        <div style={{ marginTop: 8, fontSize: 12, fontFamily: fontStack, display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Payment method */}
          {methodLabel && (
            <p style={{ color: colors.textSec, margin: 0 }}>
              <span style={{ fontWeight: 500 }}>Method:</span> {methodLabel}
            </p>
          )}

          {/* Payment ID (transaction_id) */}
          {entry.transaction_id && (
            <p style={{ color: colors.textSec, wordBreak: "break-all", margin: 0 }}>
              <span style={{ fontWeight: 500 }}>Payment ID:</span>{" "}
              <code style={{ background: colors.bgHover, padding: "1px 4px", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }}>
                {entry.transaction_id}
              </code>
            </p>
          )}

          {/* Refund ID */}
          {entry.refund_id && (
            <p style={{ color: colors.textSec, wordBreak: "break-all", margin: 0 }}>
              <span style={{ fontWeight: 500 }}>Refund ID:</span>{" "}
              <code style={{ background: colors.bgHover, padding: "1px 4px", borderRadius: 4, fontFamily: "monospace", fontSize: 11 }}>
                {entry.refund_id}
              </code>
            </p>
          )}

          {/* Tracking info */}
          {entry.tracking_number && (
            <p style={{ color: colors.textSec, margin: 0 }}>
              <span style={{ fontWeight: 500 }}>Tracking:</span> {entry.tracking_number}{" "}
              {entry.tracking_carrier && `(${entry.tracking_carrier})`}
            </p>
          )}

          {/* Error */}
          {entry.error_message && (
            <div style={{ marginTop: 6, borderRadius: radii.xs, background: colors.redBg, padding: 8 }}>
              <p style={{ color: colors.red, margin: 0 }}>
                <span style={{ fontWeight: 500 }}>Error:</span> {entry.error_message}
              </p>
              {entry.error_code && (
                <p style={{ fontSize: 11, color: colors.red, marginTop: 4, margin: 0 }}>
                  Code: {entry.error_code}
                </p>
              )}
            </div>
          )}

          {/* Detail text */}
          {entry.detail && !entry.error_message && (
            <p style={{ color: colors.textSec, fontStyle: "italic", margin: 0 }}>{entry.detail}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatEventLabel(event: string): string {
  const labelMap: Record<string, string> = {
    received: "Payment Received",
    initiate: "Payment Initiated",
    authorization: "Payment Authorized",
    capture: "Payment Captured",
    refund: "Payment Refunded",
    cancellation: "Payment Cancelled",
    status_update: "Status Updated",
    tracking_sent: "Tracking Information Sent",
  }
  return labelMap[event] || event
}

function formatCurrency(amount: number, currency: string): string {
  // Amounts might come as cents (int) or as euros (decimal string like "0.01")
  // If amount > 100, likely in cents; if < 1, likely already in major units
  const value = amount >= 100 ? amount / 100 : amount
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(value)
}
