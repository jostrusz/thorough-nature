import React from "react"

interface OrderDetailItemsProps {
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
  fontSize: "15px",
  fontWeight: 600,
  color: "#1A1A1A",
  marginBottom: "18px",
}

export function OrderDetailItems({ order }: OrderDetailItemsProps) {
  const items = order.items || []
  const currency = order.currency_code

  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>Items</div>

      {items.length === 0 ? (
        <p style={{ fontSize: "14px", color: "#8C9196" }}>No items</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {items.map((item: any) => {
            const productTitle =
              item.variant?.product?.title || item.title || "Unknown product"
            const variantTitle = item.variant?.title || ""
            const thumbnail = item.variant?.product?.thumbnail || item.thumbnail
            const quantity = item.quantity || 1
            const unitPrice = Number(item.unit_price) || 0
            const total = unitPrice * quantity

            return (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px",
                  background: "#F6F6F7",
                  borderRadius: "8px",
                }}
              >
                {/* Thumbnail */}
                {thumbnail ? (
                  <img
                    src={thumbnail}
                    alt={productTitle}
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "6px",
                      objectFit: "cover",
                      border: "1px solid #E1E3E5",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "6px",
                      background: "#E1E3E5",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "20px",
                      color: "#8C9196",
                    }}
                  >
                    {"\uD83D\uDCD6"}
                  </div>
                )}

                {/* Info */}
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "14px",
                      fontWeight: 600,
                      color: "#1A1A1A",
                    }}
                  >
                    {productTitle}
                  </div>
                  {variantTitle && variantTitle !== "default" && (
                    <div
                      style={{
                        fontSize: "12px",
                        color: "#6D7175",
                        marginTop: "2px",
                      }}
                    >
                      {variantTitle}
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: "13px",
                      color: "#6D7175",
                      marginTop: "3px",
                    }}
                  >
                    {quantity}&times; {formatCurrency(unitPrice, currency)}
                  </div>
                </div>

                {/* Total */}
                <div
                  style={{
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#1A1A1A",
                  }}
                >
                  {formatCurrency(total, currency)}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Totals */}
      <div
        style={{
          marginTop: "16px",
          paddingTop: "16px",
          borderTop: "1px solid #E1E3E5",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "8px",
            fontSize: "14px",
            color: "#6D7175",
          }}
        >
          <span>Shipping</span>
          <span>
            {formatCurrency(Number(order.shipping_total) || 0, currency)}
          </span>
        </div>
        {Number(order.tax_total) > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "8px",
              fontSize: "14px",
              color: "#6D7175",
            }}
          >
            <span>Tax</span>
            <span>
              {formatCurrency(Number(order.tax_total) || 0, currency)}
            </span>
          </div>
        )}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "15px",
            fontWeight: 700,
            color: "#1A1A1A",
            marginTop: "10px",
            paddingTop: "10px",
            borderTop: "1px solid #E1E3E5",
          }}
        >
          <span>Total</span>
          <span>{formatCurrency(Number(order.total) || 0, currency)}</span>
        </div>
      </div>
    </div>
  )
}
