import React from "react"

interface OrderDetailPaymentProps {
  order: any
}

function formatCurrency(amount: number, currency?: string) {
  const c = (currency || "EUR").toUpperCase()
  if (c === "EUR") return `\u20AC${amount.toFixed(2)}`
  return `${amount.toFixed(2)} ${c}`
}

const sectionStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  padding: "20px",
  marginBottom: "16px",
}

const sectionTitleStyle: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "#1A1A1A",
  marginBottom: "16px",
}

export function OrderDetailPayment({ order }: OrderDetailPaymentProps) {
  const paymentCollections = order.payment_collections || []
  const payments = paymentCollections.flatMap((pc: any) => pc.payments || [])
  const currency = order.currency_code

  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>Payment</div>

      {payments.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {payments.map((payment: any) => (
            <div
              key={payment.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px 12px",
                background: "#F6F6F7",
                borderRadius: "8px",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "#1A1A1A",
                  }}
                >
                  {payment.provider_id
                    ? payment.provider_id.replace("pp_", "").replace(/_/g, " ")
                    : "Payment"}
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "#6D7175",
                    marginTop: "2px",
                  }}
                >
                  {new Date(payment.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </div>
              </div>
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#1A1A1A",
                }}
              >
                {formatCurrency(Number(payment.amount) || 0, currency)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: "13px", color: "#8C9196" }}>
          No payment information available
        </p>
      )}

      {/* Shipping methods */}
      {order.shipping_methods && order.shipping_methods.length > 0 && (
        <>
          <div
            style={{
              ...sectionTitleStyle,
              marginTop: "20px",
              paddingTop: "16px",
              borderTop: "1px solid #E1E3E5",
            }}
          >
            Shipping
          </div>
          {order.shipping_methods.map((method: any) => (
            <div
              key={method.id}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "8px 0",
                fontSize: "13px",
              }}
            >
              <span style={{ color: "#1A1A1A" }}>
                {method.name || method.shipping_option_id || "Shipping"}
              </span>
              <span style={{ color: "#6D7175" }}>
                {formatCurrency(Number(method.amount) || 0, currency)}
              </span>
            </div>
          ))}
        </>
      )}
    </div>
  )
}
