import React from "react"
import { PaymentBadge } from "./order-badges"
import { formatCurrency } from "../../lib/format-currency"

interface OrderDetailPaymentProps {
  order: any
  onCapture?: () => void
  isCapturing?: boolean
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

const rowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "6px 4px",
  fontSize: "13px",
  borderRadius: "4px",
  margin: "0 -4px",
  transition: "background 0.12s ease",
}

export function OrderDetailPayment({ order, onCapture, isCapturing }: OrderDetailPaymentProps) {
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
    <div
      className="od-card"
      style={{
        background: "#FFFFFF",
        border: "1px solid #E1E3E5",
        borderRadius: "10px",
        marginBottom: "16px",
        overflow: "hidden",
        transition: "box-shadow 0.25s ease, transform 0.25s ease",
      }}
    >
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
        <div className="od-row-hover" style={rowStyle}>
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
          <div className="od-row-hover" style={rowStyle}>
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
        <div className="od-row-hover" style={rowStyle}>
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
          <div className="od-row-hover" style={rowStyle}>
            <span style={{ color: "#6D7175" }}>
              Taxes
              <span style={{ marginLeft: "8px", color: "#8C9196", fontSize: "12px" }}>
                {order.metadata?.tax_rate || "VAT"} (Included)
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
          <div className="od-row-hover" style={rowStyle}>
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

        {/* Payment provider info + Payment IDs */}
        {payments.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            {payments.map((payment: any) => {
              const providerName = payment.provider_id
                ? payment.provider_id.replace(/^pp_/, "").replace(/_.*$/, "").replace(/^\w/, (c: string) => c.toUpperCase())
                : ""
              const methodRaw = payment.data?.method || ""
              const METHOD_LABELS: Record<string, string> = {
                ideal: "iDEAL", creditcard: "Credit Card", bancontact: "Bancontact",
                klarnapaylater: "Klarna", klarna: "Klarna", paypal: "PayPal",
                applepay: "Apple Pay", eps: "EPS", przelewy24: "Przelewy24",
              }
              const methodLabel = METHOD_LABELS[methodRaw] || methodRaw || ""
              const provider = [providerName, methodLabel].filter(Boolean).join(" — ") || "Payment"
              const gatewayId =
                payment.data?.molliePaymentId ||
                payment.data?.mollieOrderId ||
                payment.data?.paypalOrderId ||
                payment.data?.id ||
                payment.data?.payment_intent ||
                payment.data?.payment_id ||
                payment.data?.transaction_id ||
                null

              return (
                <div key={payment.id}>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#8C9196",
                      padding: "2px 0",
                    }}
                  >
                    {provider} \u2022{" "}
                    {new Date(payment.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                  {/* Payment Gateway ID */}
                  {gatewayId && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6D7175",
                        padding: "2px 0",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span style={{ color: "#8C9196" }}>Payment ID:</span>
                      <code
                        style={{
                          fontSize: "11px",
                          background: "#F6F6F7",
                          padding: "1px 6px",
                          borderRadius: "4px",
                          color: "#1A1A1A",
                          fontFamily: "monospace",
                        }}
                      >
                        {gatewayId}
                      </code>
                    </div>
                  )}
                  {/* Medusa Payment ID */}
                  <div
                    style={{
                      fontSize: "12px",
                      color: "#6D7175",
                      padding: "2px 0",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span style={{ color: "#8C9196" }}>Medusa ID:</span>
                    <code
                      style={{
                        fontSize: "11px",
                        background: "#F6F6F7",
                        padding: "1px 6px",
                        borderRadius: "4px",
                        color: "#8C9196",
                        fontFamily: "monospace",
                      }}
                    >
                      {payment.id}
                    </code>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* PayPal capture button — shown when payment is authorized but not yet captured */}
        {payments.some((p: any) =>
          p.provider_id?.includes("paypal") &&
          (p.data?.paypalOrderId || p.data?.authorizationId) &&
          !order.metadata?.payment_captured
        ) && (
          <div
            style={{
              borderTop: "1px solid #E1E3E5",
              marginTop: "12px",
              paddingTop: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#FFF3CD",
                  color: "#856404",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "10px",
                }}
              >
                ⓘ PayPal — Authorized (not yet captured)
              </span>
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#8C9196",
                marginBottom: "8px",
              }}
            >
              PayPal authorizations must be captured within 29 days.
              Capture after shipping the order.
            </div>
            {onCapture && (
              <button
                onClick={onCapture}
                disabled={isCapturing}
                className="od-btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  background: "#0070BA",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isCapturing ? "not-allowed" : "pointer",
                  opacity: isCapturing ? 0.7 : 1,
                }}
              >
                {isCapturing ? (
                  <>
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    Capturing...
                  </>
                ) : (
                  "💳 Capture PayPal Payment"
                )}
              </button>
            )}
          </div>
        )}

        {/* PayPal Order ID display */}
        {payments.some((p: any) => p.data?.paypalOrderId) && (
          <div style={{ marginTop: "8px" }}>
            {payments
              .filter((p: any) => p.data?.paypalOrderId)
              .map((payment: any) => (
                <div
                  key={`paypal-${payment.id}`}
                  style={{
                    fontSize: "12px",
                    color: "#6D7175",
                    padding: "2px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ color: "#8C9196" }}>PayPal Order:</span>
                  <code
                    style={{
                      fontSize: "11px",
                      background: "#F6F6F7",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      color: "#1A1A1A",
                      fontFamily: "monospace",
                    }}
                  >
                    {payment.data.paypalOrderId}
                  </code>
                </div>
              ))}
          </div>
        )}

        {/* Klarna capture button — shown when payment is authorized but not yet captured */}
        {payments.some((p: any) =>
          p.provider_id?.includes("klarna") &&
          p.data?.klarnaOrderId &&
          !order.metadata?.payment_captured
        ) && (
          <div
            style={{
              borderTop: "1px solid #E1E3E5",
              marginTop: "12px",
              paddingTop: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  background: "#FFF3CD",
                  color: "#856404",
                  fontSize: "11px",
                  fontWeight: 600,
                  padding: "2px 8px",
                  borderRadius: "10px",
                }}
              >
                ⓘ Klarna — Authorized (not yet captured)
              </span>
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "#8C9196",
                marginBottom: "8px",
              }}
            >
              Klarna payments must be captured within 28 days of authorization.
              Capture after shipping the order.
            </div>
            {onCapture && (
              <button
                onClick={onCapture}
                disabled={isCapturing}
                className="od-btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 16px",
                  background: "#008060",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: isCapturing ? "not-allowed" : "pointer",
                  opacity: isCapturing ? 0.7 : 1,
                }}
              >
                {isCapturing ? (
                  <>
                    <span
                      style={{
                        width: "14px",
                        height: "14px",
                        border: "2px solid rgba(255,255,255,0.3)",
                        borderTopColor: "#fff",
                        borderRadius: "50%",
                        animation: "spin 0.8s linear infinite",
                        display: "inline-block",
                      }}
                    />
                    Capturing...
                  </>
                ) : (
                  "💳 Capture Payment"
                )}
              </button>
            )}
          </div>
        )}

        {/* Klarna Order ID display */}
        {payments.some((p: any) => p.data?.klarnaOrderId) && (
          <div style={{ marginTop: "8px" }}>
            {payments
              .filter((p: any) => p.data?.klarnaOrderId)
              .map((payment: any) => (
                <div
                  key={`klarna-${payment.id}`}
                  style={{
                    fontSize: "12px",
                    color: "#6D7175",
                    padding: "2px 0",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span style={{ color: "#8C9196" }}>Klarna Order:</span>
                  <code
                    style={{
                      fontSize: "11px",
                      background: "#F6F6F7",
                      padding: "1px 6px",
                      borderRadius: "4px",
                      color: "#1A1A1A",
                      fontFamily: "monospace",
                    }}
                  >
                    {payment.data.klarnaOrderId}
                  </code>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  )
}
