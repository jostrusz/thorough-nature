import React from "react"
import { CheckCircleSolid, XCircleSolid, ArrowUpRightOnBox, ExclamationCircle } from "@medusajs/icons"

interface PaymentActivityEntry {
  timestamp: string
  event: string
  gateway: string
  payment_method?: string
  status: "success" | "error" | "pending"
  amount?: number
  currency?: string
  transaction_id?: string
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

const GATEWAY_COLORS: Record<string, string> = {
  stripe: "pa-bg-blue pa-text-blue pa-border-blue",
  paypal: "pa-bg-indigo pa-text-indigo pa-border-indigo",
  mollie: "pa-bg-cyan pa-text-cyan pa-border-cyan",
  klarna: "pa-bg-pink pa-text-pink pa-border-pink",
  comgate: "pa-bg-orange pa-text-orange pa-border-orange",
  przelewy24: "pa-bg-green pa-text-green pa-border-green",
  airwallex: "pa-bg-purple pa-text-purple pa-border-purple",
}

const GATEWAY_DISPLAY_NAMES: Record<string, string> = {
  stripe: "Stripe",
  paypal: "PayPal",
  mollie: "Mollie",
  klarna: "Klarna",
  comgate: "Comgate",
  przelewy24: "Przelewy24",
  airwallex: "Airwallex",
}

export const PaymentActivityLog: React.FC<OrderPaymentActivityProps> = ({
  order,
}) => {
  const activityLog = (order.metadata?.payment_activity_log ||
    []) as PaymentActivityEntry[]

  if (!activityLog || activityLog.length === 0) {
    return (
      <div style={{ borderRadius: 10, border: "1px solid #E1E3E5", background: "#fff", padding: 24 }}>
        <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600, color: "#111" }}>
          Payment Activity
        </h3>
        <p style={{ fontSize: 14, color: "#6b7280" }}>No payment activity recorded.</p>
      </div>
    )
  }

  const sortedLog = [...activityLog].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div style={{ borderRadius: 10, border: "1px solid #E1E3E5", background: "#fff", padding: 24 }}>
      <h3 style={{ marginBottom: 24, fontSize: 16, fontWeight: 600, color: "#111" }}>
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

  const gatewayLabel = GATEWAY_DISPLAY_NAMES[entry.gateway] || entry.gateway
  const eventLabel = formatEventLabel(entry.event)

  const getStatusIcon = () => {
    if (entry.event === "tracking_sent") {
      return <ArrowUpRightOnBox style={{ width: 16, height: 16, color: "#2563eb" }} />
    }
    if (entry.status === "success") {
      return <CheckCircleSolid style={{ width: 16, height: 16, color: "#16a34a" }} />
    }
    if (entry.status === "error") {
      return <XCircleSolid style={{ width: 16, height: 16, color: "#dc2626" }} />
    }
    return <ExclamationCircle style={{ width: 16, height: 16, color: "#ca8a04" }} />
  }

  const getStatusBg = () => {
    if (entry.event === "tracking_sent") return "#dbeafe"
    if (entry.status === "success") return "#dcfce7"
    if (entry.status === "error") return "#fee2e2"
    return "#fef9c3"
  }

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
          background: "#E1E3E5",
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
            <p style={{ fontSize: 12, color: "#6b7280" }}>{formattedTime}</p>
            <p style={{ fontSize: 14, fontWeight: 500, color: "#111", marginTop: 4 }}>{eventLabel}</p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              display: "inline-block",
              borderRadius: 9999,
              border: "1px solid #d1d5db",
              padding: "2px 12px",
              fontSize: 12,
              fontWeight: 500,
            }}>
              {gatewayLabel}
            </span>

            {entry.amount && entry.currency && (
              <span style={{ fontSize: 14, fontWeight: 600, color: "#111" }}>
                {formatCurrency(entry.amount, entry.currency)}
              </span>
            )}
          </div>
        </div>

        {/* Details section */}
        <div style={{ marginTop: 12, fontSize: 12 }}>
          {entry.payment_method && (
            <p style={{ color: "#4b5563" }}>
              <span style={{ fontWeight: 500 }}>Method:</span> {entry.payment_method}
            </p>
          )}

          {entry.transaction_id && (
            <p style={{ color: "#4b5563", wordBreak: "break-all" }}>
              <span style={{ fontWeight: 500 }}>Transaction ID:</span>{" "}
              <code style={{ background: "#f3f4f6", padding: "1px 4px", borderRadius: 4, fontFamily: "monospace" }}>
                {entry.transaction_id}
              </code>
            </p>
          )}

          {entry.tracking_number && (
            <p style={{ color: "#4b5563" }}>
              <span style={{ fontWeight: 500 }}>Tracking:</span> {entry.tracking_number}{" "}
              {entry.tracking_carrier && `(${entry.tracking_carrier})`}
            </p>
          )}

          {entry.error_message && (
            <div style={{ marginTop: 8, borderRadius: 6, background: "#fef2f2", padding: 8 }}>
              <p style={{ color: "#b91c1c" }}>
                <span style={{ fontWeight: 500 }}>Error:</span> {entry.error_message}
              </p>
              {entry.error_code && (
                <p style={{ fontSize: 11, color: "#dc2626", marginTop: 4 }}>
                  Code: {entry.error_code}
                </p>
              )}
            </div>
          )}

          {entry.detail && !entry.error_message && (
            <p style={{ color: "#4b5563", fontStyle: "italic" }}>{entry.detail}</p>
          )}
        </div>
      </div>
    </div>
  )
}

function formatEventLabel(event: string): string {
  const labelMap: Record<string, string> = {
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
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100)
}
