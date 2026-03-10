import type React from "react"

// ═══ Design Tokens 2026 ═══

export const colors = {
  bg: "#fafafa",
  bgCard: "#FFFFFF",
  bgHover: "#F8F9FC",
  border: "rgba(0,0,0,0.07)",
  borderActive: "rgba(0,0,0,0.14)",
  text: "#1A1D2E",
  textSec: "#6B7185",
  textMuted: "#9CA3B8",
  accent: "#6C5CE7",
  accentBg: "rgba(108,92,231,0.08)",
  green: "#00B37A",
  greenBg: "rgba(0,179,122,0.08)",
  red: "#E74C3C",
  redBg: "rgba(231,76,60,0.07)",
  yellow: "#D4A017",
  yellowBg: "rgba(212,160,23,0.08)",
  blue: "#3B82F6",
  blueBg: "rgba(59,130,246,0.07)",
  orange: "#E67E22",
  orangeBg: "rgba(230,126,34,0.07)",
} as const

export const shadows = {
  card: "0 1px 3px rgba(0,0,0,0.04), 0 4px 24px rgba(0,0,0,0.03)",
  sm: "0 1px 3px rgba(0,0,0,0.04)",
  btn: "0 1px 4px rgba(108,92,231,0.25)",
} as const

export const radii = {
  card: "14px",
  sm: "10px",
  xs: "6px",
} as const

export const fontStack = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"

// ═══ Shared Styles ═══

export const cardStyle: React.CSSProperties = {
  background: colors.bgCard,
  border: `1px solid ${colors.border}`,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  marginBottom: "16px",
  overflow: "hidden",
}

export const cardHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: `1px solid ${colors.border}`,
  fontSize: "15px",
  fontWeight: 600,
  color: colors.text,
}

export const btnOutline: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "8px 16px",
  borderRadius: radii.xs,
  fontSize: "13px",
  fontWeight: 500,
  cursor: "pointer",
  border: `1px solid ${colors.border}`,
  background: colors.bgCard,
  color: colors.textSec,
  transition: "all 0.15s",
}

export const btnPrimary: React.CSSProperties = {
  ...btnOutline,
  background: colors.accent,
  color: "#fff",
  border: `1px solid ${colors.accent}`,
  boxShadow: shadows.btn,
}

// ═══ Payment Method Icons ═══

const ICON_BASE = "https://raw.githubusercontent.com/datatrans/payment-logos/master/assets"

export function getPaymentIconUrl(order: any): string {
  const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const payment = payments[0]
  const providerId = payment?.provider_id || ""
  const method = order.metadata?.payment_method || payment?.data?.method || ""

  if (providerId.includes("klarna")) return `${ICON_BASE}/apm/klarna.svg`
  if (providerId.includes("paypal")) return `${ICON_BASE}/apm/paypal.svg`

  // Stripe — map method to specific icon
  if (providerId.includes("stripe")) {
    const map: Record<string, string> = {
      card: "cards/visa.svg",
      creditcard: "cards/visa.svg",
      ideal: "apm/ideal.svg",
      bancontact: "apm/bancontact.svg",
      klarna: "apm/klarna.svg",
      eps: "apm/eps.svg",
      p24: "apm/przelewy24.svg",
      sepa_debit: "apm/sepa.svg",
      applepay: "wallets/apple-pay.svg",
      googlepay: "wallets/google-pay.svg",
      revolut_pay: "apm/revolut.svg",
    }
    return `${ICON_BASE}/${map[method] || "cards/visa.svg"}`
  }

  // Airwallex — map method to specific icon
  if (providerId.includes("airwallex")) {
    const map: Record<string, string> = {
      card: "cards/visa.svg",
      creditcard: "cards/visa.svg",
      ideal: "apm/ideal.svg",
      bancontact: "apm/bancontact.svg",
      applepay: "wallets/apple-pay.svg",
      googlepay: "wallets/google-pay.svg",
    }
    return `${ICON_BASE}/${map[method] || "cards/visa.svg"}`
  }

  // Mollie — map method to specific icon
  if (providerId.includes("mollie")) {
    const map: Record<string, string> = {
      ideal: "apm/ideal.svg",
      bancontact: "apm/bancontact.svg",
      creditcard: "cards/visa.svg",
      applepay: "wallets/apple-pay.svg",
      googlepay: "wallets/google-pay.svg",
    }
    return `${ICON_BASE}/${map[method] || "apm/ideal.svg"}`
  }

  return ""
}

export function getPaymentFallback(order: any): { letter: string; bg: string; color: string } {
  const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const providerId = payments[0]?.provider_id || ""
  if (providerId.includes("cod")) return { letter: "D", bg: "#8B6914", color: "#fff" }
  if (providerId.includes("stripe")) return { letter: "S", bg: "#635BFF", color: "#fff" }
  if (providerId.includes("airwallex")) return { letter: "AW", bg: "#FF5100", color: "#fff" }
  if (providerId.includes("comgate")) return { letter: "C", bg: "#444", color: "#fff" }
  if (providerId.includes("przelewy") || providerId.includes("p24")) return { letter: "P24", bg: "#D40E2F", color: "#fff" }
  return { letter: "?", bg: colors.textMuted, color: "#fff" }
}

export function getPaymentMethodName(order: any): string {
  const payments = order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
  const payment = payments[0]
  const providerId = payment?.provider_id || ""
  const method = order.metadata?.payment_method || payment?.data?.method || ""

  if (providerId.includes("cod")) return "Dobírka (COD)"
  if (providerId.includes("klarna")) return "Klarna"
  if (providerId.includes("paypal")) return "PayPal"
  if (providerId.includes("comgate")) return "Comgate"
  if (providerId.includes("przelewy") || providerId.includes("p24")) return "Przelewy24"

  if (providerId.includes("stripe")) {
    const names: Record<string, string> = {
      card: "Credit Card",
      creditcard: "Credit Card",
      ideal: "iDEAL",
      bancontact: "Bancontact",
      klarna: "Klarna",
      eps: "EPS",
      p24: "Przelewy24",
      sepa_debit: "SEPA Direct Debit",
      applepay: "Apple Pay",
      googlepay: "Google Pay",
      revolut_pay: "Revolut Pay",
    }
    return names[method] || "Stripe"
  }

  if (providerId.includes("airwallex")) {
    const names: Record<string, string> = {
      card: "Credit Card",
      creditcard: "Credit Card",
      ideal: "iDEAL",
      bancontact: "Bancontact",
      applepay: "Apple Pay",
      googlepay: "Google Pay",
    }
    return names[method] || "Airwallex"
  }

  if (providerId.includes("mollie")) {
    const names: Record<string, string> = {
      ideal: "iDEAL",
      bancontact: "Bancontact",
      creditcard: "Credit Card",
      applepay: "Apple Pay",
      googlepay: "Google Pay",
    }
    return names[method] || "Mollie"
  }

  return "Payment"
}

// ═══ Order Display Number ═══

/** Get the display-friendly order number (country-prefixed or fallback to #display_id) */
export function getOrderDisplayNumber(order: any): string {
  if (order.metadata?.custom_order_number) {
    return order.metadata.custom_order_number
  }

  // Fallback: generate the format from available data
  // (subscriber may have failed or not run yet)
  const cc = (
    order.shipping_address?.country_code ||
    order.billing_address?.country_code ||
    "nl"
  ).toUpperCase()
  const year = order.created_at
    ? new Date(order.created_at).getFullYear()
    : new Date().getFullYear()
  return `${cc}${year}-${order.display_id}`
}
