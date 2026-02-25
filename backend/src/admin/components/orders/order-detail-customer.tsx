import React from "react"

interface OrderDetailCustomerProps {
  order: any
  orderCount?: number
  totalSpent?: number
}

const sectionStyle: React.CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E1E3E5",
  borderRadius: "10px",
  padding: "16px 20px",
  marginBottom: "16px",
}

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: "#6D7175",
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  marginBottom: "6px",
  marginTop: "16px",
}

const valueStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "#1A1A1A",
  lineHeight: 1.5,
}

const FLAGS: Record<string, string> = {
  NL: "\u{1F1F3}\u{1F1F1}",
  BE: "\u{1F1E7}\u{1F1EA}",
  DE: "\u{1F1E9}\u{1F1EA}",
  AT: "\u{1F1E6}\u{1F1F9}",
  PL: "\u{1F1F5}\u{1F1F1}",
  CZ: "\u{1F1E8}\u{1F1FF}",
  SK: "\u{1F1F8}\u{1F1F0}",
  SE: "\u{1F1F8}\u{1F1EA}",
  HU: "\u{1F1ED}\u{1F1FA}",
  LU: "\u{1F1F1}\u{1F1FA}",
  DK: "\u{1F1E9}\u{1F1F0}",
}

const COUNTRY_NAMES: Record<string, string> = {
  NL: "Netherlands",
  BE: "Belgium",
  DE: "Germany",
  AT: "Austria",
  PL: "Poland",
  CZ: "Czech Republic",
  SK: "Slovakia",
  SE: "Sweden",
  HU: "Hungary",
  LU: "Luxembourg",
  DK: "Denmark",
}

function buildMapUrl(addr: any): string {
  const parts = [
    addr.address_1,
    addr.address_2,
    addr.postal_code,
    addr.city,
    addr.province,
    COUNTRY_NAMES[addr.country_code?.toUpperCase()] || addr.country_code,
  ].filter(Boolean)
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts.join(", "))}`
}

function renderAddress(addr: any) {
  const countryCode = addr.country_code?.toUpperCase() || ""
  const flag = FLAGS[countryCode] || ""
  const countryName = COUNTRY_NAMES[countryCode] || countryCode
  const mapUrl = buildMapUrl(addr)

  return (
    <div style={valueStyle}>
      {addr.first_name || addr.last_name ? (
        <div>
          {[addr.first_name, addr.last_name].filter(Boolean).join(" ")}
        </div>
      ) : null}
      {addr.address_1 && <div>{addr.address_1}</div>}
      {addr.address_2 && <div>{addr.address_2}</div>}
      <div>
        {[addr.postal_code, addr.city].filter(Boolean).join(" ")}
      </div>
      {addr.province && <div>{addr.province}</div>}
      <div>
        {flag} {countryName}
      </div>
      {addr.phone && (
        <div style={{ color: "#6D7175", marginTop: "4px" }}>{addr.phone}</div>
      )}
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "inline-block",
          fontSize: "12px",
          color: "#2C6ECB",
          textDecoration: "none",
          marginTop: "4px",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
        onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
      >
        View map
      </a>
    </div>
  )
}

export function OrderDetailCustomer({
  order,
  orderCount,
  totalSpent,
}: OrderDetailCustomerProps) {
  const addr = order.shipping_address
  const name = addr
    ? [addr.first_name, addr.last_name].filter(Boolean).join(" ")
    : ""

  return (
    <div style={sectionStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "4px",
        }}
      >
        <span style={{ fontSize: "14px", fontWeight: 600, color: "#1A1A1A" }}>
          Customer
        </span>
      </div>

      {/* Customer name as link */}
      <div style={{ marginBottom: "2px" }}>
        <a
          href={order.customer_id ? `/app/customers/${order.customer_id}` : "#"}
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#2C6ECB",
            textDecoration: "none",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
          onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
        >
          {name || "Unknown customer"}
        </a>
      </div>

      {/* Order count */}
      {orderCount !== undefined && (
        <div style={{ fontSize: "12px", color: "#008060", marginBottom: "8px" }}>
          {orderCount} {orderCount === 1 ? "order" : "orders"}
        </div>
      )}

      {/* Contact information */}
      <div style={labelStyle}>Contact information</div>
      {order.email && (
        <div style={{ ...valueStyle, color: "#2C6ECB", marginBottom: "2px" }}>
          {order.email}
        </div>
      )}
      <div style={{ ...valueStyle, color: "#6D7175" }}>
        {addr?.phone || "No phone number"}
      </div>

      {/* Shipping Address */}
      {addr && (
        <>
          <div style={labelStyle}>Shipping address</div>
          {renderAddress(addr)}
        </>
      )}

      {/* Billing Address */}
      {order.billing_address && (
        <>
          <div style={labelStyle}>Billing address</div>
          {renderAddress(order.billing_address)}
        </>
      )}
    </div>
  )
}
