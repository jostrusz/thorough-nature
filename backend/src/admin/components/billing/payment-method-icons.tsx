import React from "react"

/**
 * Payment Method Icon Library
 *
 * Maps payment method codes to their brand icons/badges.
 * Used in both admin settings and checkout display.
 *
 * Icon keys: creditcard, card, visa, mastercard, amex, ideal, bancontact,
 *            klarna, paypal, przelewy24, blik, applepay, googlepay,
 *            eps, in3, belfius, kbc, riverty, trustly, sepa
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
    case "creditcard":
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
    case "klarna":
    case "klarna_later":
    case "klarna_slice":
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
    case "in3":
      return <div style={{ ...style, background: "#1A1A2E", color: "#FFFFFF" }}>in3</div>
    case "belfius":
      return <div style={{ ...style, background: "#005DA6", color: "#FFFFFF" }}>BEL</div>
    case "kbc":
      return <div style={{ ...style, background: "#003B6F", color: "#FFFFFF" }}>KBC</div>
    case "riverty":
      return <div style={{ ...style, background: "#69B32D", color: "#FFFFFF" }}>RIV</div>
    case "trustly":
      return <div style={{ ...style, background: "#0EE06E", color: "#FFFFFF" }}>TLY</div>
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
 * Payment method definition with country/currency availability.
 * available_countries: ISO 3166-1 alpha-2 codes (lowercase). Empty = global.
 * supported_currencies: ISO 4217 codes (uppercase). Empty = all currencies.
 */
export interface PaymentMethodDef {
  code: string
  name: string
  icon: string
  available_countries: string[]
  supported_currencies: string[]
}

/**
 * All available payment methods per gateway provider.
 * Used in the admin UI for the method selector.
 *
 * Country data sources:
 * - Mollie: https://docs.mollie.com/payments/methods
 * - Stripe: https://docs.stripe.com/payments/payment-methods/overview
 */
export const PAYMENT_METHODS_BY_PROVIDER: Record<string, PaymentMethodDef[]> = {
  stripe: [
    { code: "creditcard", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "ideal", name: "iDEAL", icon: "ideal", available_countries: ["nl"], supported_currencies: ["EUR"] },
    { code: "bancontact", name: "Bancontact", icon: "bancontact", available_countries: ["be"], supported_currencies: ["EUR"] },
    { code: "eps", name: "EPS", icon: "eps", available_countries: ["at"], supported_currencies: ["EUR"] },
    { code: "sepa_debit", name: "SEPA Direct Debit", icon: "sepa", available_countries: [], supported_currencies: ["EUR"] },
    { code: "klarna", name: "Klarna", icon: "klarna", available_countries: ["nl", "be", "de", "at", "fi", "fr", "it", "se", "es", "dk", "no", "gb", "ie", "pt", "pl", "cz"], supported_currencies: [] },
    { code: "przelewy24", name: "Przelewy24", icon: "przelewy24", available_countries: ["pl"], supported_currencies: ["PLN", "EUR"] },
    { code: "applepay", name: "Apple Pay", icon: "applepay", available_countries: [], supported_currencies: [] },
    { code: "googlepay", name: "Google Pay", icon: "googlepay", available_countries: [], supported_currencies: [] },
    { code: "revolut_pay", name: "Revolut Pay", icon: "revolut", available_countries: ["nl","be","de","at","fr","gb","ie","es","it","pt","fi","se","dk","no","pl","cz","ro","hu"], supported_currencies: ["EUR","GBP","PLN","RON","HUF","DKK","SEK","NOK","CZK"] },
  ],
  mollie: [
    { code: "creditcard", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "ideal", name: "iDEAL", icon: "ideal", available_countries: ["nl"], supported_currencies: ["EUR"] },
    { code: "bancontact", name: "Bancontact", icon: "bancontact", available_countries: ["be"], supported_currencies: ["EUR"] },
    { code: "eps", name: "EPS", icon: "eps", available_countries: ["at"], supported_currencies: ["EUR"] },
    { code: "przelewy24", name: "Przelewy24", icon: "przelewy24", available_countries: ["pl"], supported_currencies: ["PLN", "EUR"] },
    { code: "blik", name: "BLIK", icon: "blik", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "in3", name: "in3", icon: "in3", available_countries: ["nl"], supported_currencies: ["EUR"] },
    { code: "belfius", name: "Belfius", icon: "belfius", available_countries: ["be"], supported_currencies: ["EUR"] },
    { code: "kbc", name: "KBC/CBC", icon: "kbc", available_countries: ["be"], supported_currencies: ["EUR"] },
    { code: "riverty", name: "Riverty", icon: "riverty", available_countries: ["nl", "be", "de", "at"], supported_currencies: ["EUR"] },
    { code: "trustly", name: "Trustly", icon: "trustly", available_countries: ["nl", "be", "de", "fr", "fi", "se", "no", "dk", "ee", "lt", "lv"], supported_currencies: ["EUR"] },
    { code: "bank_transfer", name: "Bank Transfer", icon: "bank_transfer", available_countries: [], supported_currencies: ["EUR"] },
    { code: "applepay", name: "Apple Pay", icon: "applepay", available_countries: [], supported_currencies: [] },
  ],
  airwallex: [
    { code: "creditcard", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "ideal", name: "iDEAL", icon: "ideal", available_countries: ["nl"], supported_currencies: ["EUR"] },
    { code: "bancontact", name: "Bancontact", icon: "bancontact", available_countries: ["be"], supported_currencies: ["EUR"] },
    { code: "blik", name: "BLIK", icon: "blik", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "eps", name: "EPS", icon: "eps", available_countries: ["at"], supported_currencies: ["EUR"] },
    { code: "klarna", name: "Klarna", icon: "klarna", available_countries: ["nl", "be", "de", "at", "fi", "fr", "it", "se", "es", "dk", "no", "gb", "ie"], supported_currencies: [] },
    { code: "paypal", name: "PayPal", icon: "paypal", available_countries: [], supported_currencies: ["EUR", "USD", "GBP", "AUD", "CAD", "JPY", "PLN", "SEK", "CZK", "HUF"] },
    { code: "googlepay", name: "Google Pay", icon: "googlepay", available_countries: [], supported_currencies: [] },
    { code: "applepay", name: "Apple Pay", icon: "applepay", available_countries: [], supported_currencies: [] },
  ],
  comgate: [
    { code: "creditcard", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "bank_transfer", name: "Bank Transfer", icon: "bank_transfer", available_countries: [], supported_currencies: ["CZK", "EUR"] },
    { code: "applepay", name: "Apple Pay", icon: "applepay", available_countries: [], supported_currencies: [] },
    { code: "googlepay", name: "Google Pay", icon: "googlepay", available_countries: [], supported_currencies: [] },
  ],
  przelewy24: [
    { code: "przelewy24", name: "Przelewy24", icon: "przelewy24", available_countries: ["pl"], supported_currencies: ["PLN", "EUR"] },
    { code: "blik", name: "BLIK", icon: "blik", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "creditcard", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "bank_transfer", name: "Bank Transfer", icon: "bank_transfer", available_countries: ["pl"], supported_currencies: ["PLN", "EUR"] },
  ],
  paypal: [
    { code: "paypal", name: "PayPal", icon: "paypal", available_countries: [], supported_currencies: [] },
    { code: "creditcard", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "googlepay", name: "Google Pay", icon: "googlepay", available_countries: [], supported_currencies: [] },
    { code: "applepay", name: "Apple Pay", icon: "applepay", available_countries: [], supported_currencies: [] },
    { code: "ideal", name: "iDEAL", icon: "ideal", available_countries: ["nl"], supported_currencies: ["EUR"] },
    { code: "bancontact", name: "Bancontact", icon: "bancontact", available_countries: ["be"], supported_currencies: ["EUR"] },
    { code: "blik", name: "BLIK", icon: "blik", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "p24", name: "Przelewy24", icon: "przelewy24", available_countries: ["pl"], supported_currencies: ["PLN", "EUR"] },
    { code: "eps", name: "EPS", icon: "eps", available_countries: ["at"], supported_currencies: ["EUR"] },
    { code: "swish", name: "Swish", icon: "swish", available_countries: ["se"], supported_currencies: ["SEK"] },
  ],
  klarna: [
    { code: "klarna", name: "Klarna Pay Now", icon: "klarna", available_countries: ["nl", "be", "de", "at", "fi", "fr", "it", "se", "es", "dk", "no", "gb", "ie", "pt", "pl", "cz"], supported_currencies: [] },
    { code: "klarna_later", name: "Klarna Pay Later", icon: "klarna", available_countries: ["nl", "be", "de", "at", "fi", "fr", "it", "se", "es", "dk", "no", "gb", "ie"], supported_currencies: [] },
    { code: "klarna_slice", name: "Klarna Slice It", icon: "klarna", available_countries: ["nl", "be", "de", "at", "fi", "fr", "it", "se", "es", "dk", "no", "gb", "ie"], supported_currencies: [] },
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
