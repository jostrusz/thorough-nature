import React from "react"

interface OrderDetailCustomerProps {
  order: any
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

export function OrderDetailCustomer({ order }: OrderDetailCustomerProps) {
  const addr = order.shipping_address
  const name = addr
    ? [addr.first_name, addr.last_name].filter(Boolean).join(" ")
    : ""
  const countryCode = addr?.country_code?.toUpperCase() || ""
  const flag = FLAGS[countryCode] || ""
  const countryName = COUNTRY_NAMES[countryCode] || countryCode

  return (
    <div style={sectionStyle}>
      <div style={sectionTitleStyle}>Customer</div>

      {/* Name & Email */}
      <div style={valueStyle}>
        <strong>{name || "Unknown customer"}</strong>
      </div>
      {order.email && (
        <div style={{ ...valueStyle, color: "#2C6ECB", marginTop: "2px" }}>
          {order.email}
        </div>
      )}
      {addr?.phone && (
        <div style={{ ...valueStyle, color: "#6D7175", marginTop: "2px" }}>
          {addr.phone}
        </div>
      )}

      {/* Shipping Address */}
      {addr && (
        <>
          <div style={labelStyle}>Shipping address</div>
          <div style={valueStyle}>
            {addr.address_1 && <div>{addr.address_1}</div>}
            {addr.address_2 && <div>{addr.address_2}</div>}
            <div>
              {[addr.postal_code, addr.city].filter(Boolean).join(" ")}
            </div>
            {addr.province && <div>{addr.province}</div>}
            <div>
              {flag} {countryName}
            </div>
          </div>
        </>
      )}

      {/* Billing Address */}
      {order.billing_address && (
        <>
          <div style={labelStyle}>Billing address</div>
          <div style={valueStyle}>
            {order.billing_address.address_1 && (
              <div>{order.billing_address.address_1}</div>
            )}
            <div>
              {[
                order.billing_address.postal_code,
                order.billing_address.city,
              ]
                .filter(Boolean)
                .join(" ")}
            </div>
            <div>
              {FLAGS[order.billing_address.country_code?.toUpperCase()] || ""}{" "}
              {COUNTRY_NAMES[order.billing_address.country_code?.toUpperCase()] ||
                order.billing_address.country_code}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
