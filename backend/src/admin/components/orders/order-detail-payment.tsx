import React from "react"
import { PaymentBadge } from "./order-badges"

interface OrderDetailPaymentProps {
  order: any
}

function formatCurrency(amount: number, currency?: string) {
  const c = (currency || "EUR").toUpperCase()
  if (c === "EUR") return `\u20AC${amount.toFixed(2)}`
  return `${amount.toFixed(2)} ${c}`
}

function getPaymentStatus(order: any): string {
  if (order.payment_collections?.length) {
    const pc = order.payment_collections[0]
    if (pc.status === "captured" || pc.status === "completed") return "paid"
    if (pc.status === "refunded") return "refunded"
    return pc.status || "pending"
  }
  return "pending"
}

const sectionStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  marginBottom: "16px",
  overflow: "hidden",
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 0",
  fontSize: "13px",
}

export function OrderDetailPayment({ order }: OrderDetailPaymentProps) {
  const currency = order.currency_code
  const paymentStatus = getPaymentStatus(order)
  const items = order.items || []
  const itemCount = items.reduce((sum: number, i: any) => sum + (i.quantity || 1), 0)

  const subtotal = Number(order.subtotal) || 0
  const discountTotal = Number(order.discount_total) || 0
  const shippingTotal = Number(order.shipping_total) || 0
  const taxTotal = Number(order.tax_total) || 0
  const total = Number(order.total) || 0

  // Get discount code if any
  const discountCode =
    order.discounts?.[0]?.code ||
    order.metadata?.discount_code ||
    (discountTotal > 0 ? "Discount" : "")

  // Get shipping method name
  const shippingMethodName =
    order.shipping_methods?.[0]?.name ||
    order.shipping_methods?.[0]?.shipping_option_id ||
    "Shipping"

  // Get total paid
  const payments = (order.payment_collections || []).flatMap(
    (pc: any) => pc.payments || []
  )
  const totalPaid = payments.reduce(
    (sum: number, p: any) => sum + (Number(p.amount) || 0),
    0
  )

  return (
    <div style={sectionStyle}>
      {/* Header with payment badge */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "16px 20px",
          borderBottom: "1px solid #E1E3E5",
        }}
      >
        <PaymentBadge status={paymentStatus} />
      </div>

      {/* Payment breakdown */}
      <div style={{ padding: "16px 20px" }}>
        {/* Subtotal */}
        <div style={rowStyle}>
          <span style={{ color: "#6D7175" }}>
            Subtotal
            <span style={{ marginLeft: "8px", color: "#8C9196" }}>
              {itemCount} {itemCount === 1 ? "item" : "items"}
            </span>
          </span>
          <span style={{ color: "#1A1A1A" }}>{formatCurrency(subtotal, currency)}</span>
        </div>

        {/* Discount */}
        {discountTotal > 0 && (
          <div style={rowStyle}>
            <span style={{ color: "#6D7175" }}>
              Discount
              {discountCode && (
                <span
                  style={{
                    marginLeft: "8px",
                    fontSize: "12px",
                    background: "#F6F6F7",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    color: "#6D7175",
                    textTransform: "uppercase",
                  }}
                >
                  {discountCode}
                </span>
              )}
            </span>
            <span style={{ color: "#1A1A1A" }}>
              -{formatCurrency(discountTotal, currency)}
            </span>
          </div>
        )}

        {/* Shipping */}
        <div style={rowStyle}>
          <span style={{ color: "#6D7175" }}>
            Shipping
            <span style={{ marginLeft: "8px", color: "#8C9196", fontSize: "12px" }}>
              {shippingMethodName}
            </span>
          </span>
          <span style={{ color: "#1A1A1A" }}>
            {shippingTotal === 0
              ? formatCurrency(0, currency)
              : formatCurrency(shippingTotal, currency)}
          </span>
        </div>

        {/* Taxes */}
        {taxTotal > 0 && (
          <div style={rowStyle}>
            <span style={{ color: "#6D7175" }}>
              Taxes
              <span style={{ marginLeft: "8px", color: "#8C9196", fontSize: "12px" }}>
                {order.metadata?.tax_rate || "BTW"} (Included)
              </span>
            </span>
            <span style={{ color: "#1A1A1A" }}>
              {formatCurrency(taxTotal, currency)}
            </span>
          </div>
        )}

        {/* Divider + Total */}
        <div
          style={{
            borderTop: "1px solid #E1E3E5",
            marginTop: "8px",
            paddingTop: "8px",
          }}
        >
          <div
            style={{
              ...rowStyle,
              fontSize: "14px",
              fontWeight: 600,
            }}
          >
            <span style={{ color: "#1A1A1A" }}>Total</span>
            <span style={{ color: "#1A1A1A" }}>{formatCurrency(total, currency)}</span>
          </div>
        </div>

        {/* Paid amount */}
        <div
          style={{
            borderTop: "1px solid #E1E3E5",
            marginTop: "8px",
            paddingTop: "8px",
          }}
        >
          <div style={rowStyle}>
            <span style={{ color: "#1A1A1A", fontWeight: 500 }}>
              {paymentStatus === "paid" || paymentStatus === "captured"
                ? "Paid"
                : paymentStatus === "refunded"
                ? "Refunded"
                : "Pending"}
            </span>
            <span style={{ color: "#1A1A1A", fontWeight: 500 }}>
              {formatCurrency(totalPaid || total, currency)}
            </span>
          </div>
        </div>

        {/* Payment provider info */}
        {payments.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            {payments.map((payment: any) => (
              <div
                key={payment.id}
                style={{
                  fontSize: "12px",
                  color: "#8C9196",
                  padding: "2px 0",
                }}
              >
                {payment.provider_id
                  ? payment.provider_id.replace("pp_", "").replace(/_/g, " ")
                  : "Payment"}{" "}
                \u2022{" "}
                {new Date(payment.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
