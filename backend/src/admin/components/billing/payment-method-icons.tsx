import React from "react"

/**
 * Payment Method Icon Library
 *
 * Maps payment method codes to their brand icons/badges.
 * Used in both admin settings and checkout display.
 *
 * Icon keys: card, visa, mastercard, amex, ideal, bancontact, sofort,
 *            klarna, paypal, przelewy24, blik, applepay, googlepay,
 *            eps, giropay, sepa
 */

const ICON_SIZE = { width: 38, height: 24 }

function IconBadge({
  bg,
  text,
  label,
  fontSize = "8px",
}: {
  bg: string
  text: string
  label: string
  fontSize?: string
}) {
  return (
    <div
      style={{
        ...ICON_SIZE,
        borderRadius: "4px",
        background: bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize,
        fontWeight: 700,
        color: text,
        border: "1px solid #E1E3E5",
        flexShrink: 0,
      }}
    >
      {label}
    </div>
  )
}

export function PaymentMethodIcon({ code, size }: { code: string; size?: number }) {
  const s = size || 24
  const w = Math.round(s * 1.6)
  const style: React.CSSProperties = {
    width: w,
    height: s,
    borderRadius: "4px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    border: "1px solid #E1E3E5",
    fontSize: Math.max(7, s * 0.35),
    fontWeight: 700,
    flexShrink: 0,
  }

  switch (code) {
    case "card":
    case "visa":
      return <div style={{ ...style, background: "#1A1F71", color: "#FFFFFF" }}>VISA</div>
    case "mastercard":
      return <div style={{ ...style, background: "#EB001B", color: "#FFFFFF" }}>MC</div>
    case "amex":
      return <div style={{ ...style, background: "#006FCF", color: "#FFFFFF" }}>AMEX</div>
    case "ideal":
      return <div style={{ ...style, background: "#CC0066", color: "#FFFFFF" }}>iDEAL</div>
    case "bancontact":
      return <div style={{ ...style, background: "#005498", color: "#FFFFFF" }}>BC</div>
    case "sofort":
      return <div style={{ ...style, background: "#EF809F", color: "#FFFFFF" }}>SOFORT</div>
    case "klarna":
      return <div style={{ ...style, background: "#FFB3C7", color: "#0A0B09" }}>Klarna</div>
    case "paypal":
      return <div style={{ ...style, background: "#003087", color: "#FFFFFF" }}>PayPal</div>
    case "przelewy24":
    case "p24":
      return <div style={{ ...style, background: "#D13239", color: "#FFFFFF" }}>P24</div>
    case "blik":
      return <div style={{ ...style, background: "#000000", color: "#FFFFFF" }}>BLIK</div>
    case "applepay":
    case "apple_pay":
      return <div style={{ ...style, background: "#000000", color: "#FFFFFF" }}>{"\uF8FF"} Pay</div>
    case "googlepay":
    case "google_pay":
      return <div style={{ ...style, background: "#FFFFFF", color: "#4285F4" }}>G Pay</div>
    case "eps":
      return <div style={{ ...style, background: "#C8202F", color: "#FFFFFF" }}>EPS</div>
    case "giropay":
      return <div style={{ ...style, background: "#003A7D", color: "#FFFFFF" }}>giro</div>
    case "sepa":
    case "sepa_debit":
      return <div style={{ ...style, background: "#2B4C9B", color: "#FFFFFF" }}>SEPA</div>
    case "bank_transfer":
      return <div style={{ ...style, background: "#F6F6F7", color: "#1A1A1A" }}>Bank</div>
    default:
      return <div style={{ ...style, background: "#F6F6F7", color: "#6D7175" }}>{code.slice(0, 4).toUpperCase()}</div>
  }
}

/**
 * All available payment methods per gateway provider.
 * Used in the admin UI for the method selector.
 */
export const PAYMENT_METHODS_BY_PROVIDER: Record<
  string,
  { code: string; name: string; icon: string }[]
> = {
  stripe: [
    { code: "card", name: "Credit/Debit Card", icon: "card" },
    { code: "ideal", name: "iDEAL", icon: "ideal" },
    { code: "bancontact", name: "Bancontact", icon: "bancontact" },
    { code: "sofort", name: "SOFORT / Klarna Pay Now", icon: "sofort" },
    { code: "eps", name: "EPS", icon: "eps" },
    { code: "giropay", name: "giropay", icon: "giropay" },
    { code: "sepa_debit", name: "SEPA Direct Debit", icon: "sepa" },
    { code: "klarna", name: "Klarna", icon: "klarna" },
    { code: "przelewy24", name: "Przelewy24", icon: "przelewy24" },
    { code: "applepay", name: "Apple Pay", icon: "applepay" },
    { code: "googlepay", name: "Google Pay", icon: "googlepay" },
  ],
  mollie: [
    { code: "card", name: "Credit/Debit Card", icon: "card" },
    { code: "ideal", name: "iDEAL", icon: "ideal" },
    { code: "bancontact", name: "Bancontact", icon: "bancontact" },
    { code: "klarna", name: "Klarna", icon: "klarna" },
    { code: "sofort", name: "SOFORT", icon: "sofort" },
    { code: "eps", name: "EPS", icon: "eps" },
    { code: "giropay", name: "giropay", icon: "giropay" },
    { code: "paypal", name: "PayPal", icon: "paypal" },
    { code: "przelewy24", name: "Przelewy24", icon: "przelewy24" },
    { code: "blik", name: "BLIK", icon: "blik" },
    { code: "bank_transfer", name: "Bank Transfer", icon: "bank_transfer" },
    { code: "applepay", name: "Apple Pay", icon: "applepay" },
  ],
  airwallex: [
    { code: "card", name: "Credit/Debit Card", icon: "card" },
    { code: "klarna", name: "Klarna", icon: "klarna" },
    { code: "googlepay", name: "Google Pay", icon: "googlepay" },
    { code: "applepay", name: "Apple Pay", icon: "applepay" },
  ],
  comgate: [
    { code: "card", name: "Credit/Debit Card", icon: "card" },
    { code: "bank_transfer", name: "Bank Transfer", icon: "bank_transfer" },
    { code: "applepay", name: "Apple Pay", icon: "applepay" },
    { code: "googlepay", name: "Google Pay", icon: "googlepay" },
  ],
  przelewy24: [
    { code: "przelewy24", name: "Przelewy24", icon: "przelewy24" },
    { code: "blik", name: "BLIK", icon: "blik" },
    { code: "card", name: "Credit/Debit Card", icon: "card" },
    { code: "bank_transfer", name: "Bank Transfer", icon: "bank_transfer" },
  ],
  paypal: [
    { code: "paypal", name: "PayPal", icon: "paypal" },
  ],
  klarna: [
    { code: "klarna", name: "Klarna Pay Now", icon: "klarna" },
    { code: "klarna_later", name: "Klarna Pay Later", icon: "klarna" },
    { code: "klarna_slice", name: "Klarna Slice It", icon: "klarna" },
  ],
}

export const SUPPORTED_PROVIDERS = [
  { code: "stripe", name: "Stripe" },
  { code: "mollie", name: "Mollie" },
  { code: "airwallex", name: "Airwallex" },
  { code: "comgate", name: "Comgate" },
  { code: "przelewy24", name: "Przelewy24" },
  { code: "paypal", name: "PayPal" },
  { code: "klarna", name: "Klarna" },
]

export const SUPPORTED_CURRENCIES = ["EUR", "CZK", "PLN", "SEK", "HUF"]
