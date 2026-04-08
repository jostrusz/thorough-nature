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

// Custom SVG badges for payment methods not available in datatrans repo
const BLIK_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28"><rect width="48" height="28" rx="4" fill="%23000"/><text x="24" y="18.5" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="0.5">BLIK</text></svg>')}`
const PAYU_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28"><rect width="48" height="28" rx="4" fill="%23A6C307"/><text x="24" y="18.5" font-family="Arial,Helvetica,sans-serif" font-size="12" font-weight="bold" fill="white" text-anchor="middle">PayU</text></svg>')}`
const P24_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28"><rect width="48" height="28" rx="4" fill="%23D13239"/><text x="24" y="18.5" font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="bold" fill="white" text-anchor="middle">P24</text></svg>')}`
const TRUSTLY_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28"><rect width="48" height="28" rx="4" fill="%230EE06E"/><text x="24" y="18.5" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">Trustly</text></svg>')}`
const BANK_CZ_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28"><rect width="48" height="28" rx="4" fill="%232563EB"/><text x="24" y="18.5" font-family="Arial,Helvetica,sans-serif" font-size="10" font-weight="bold" fill="white" text-anchor="middle">BANK</text></svg>')}`

// Robust payment detection — prefers non-canceled payment collections after order edits
function findPrimaryPayment(order: any): { providerId: string; method: string; data: any } {
  const pcs = order.payment_collections || []
  // First: non-canceled payment collections
  for (const pc of pcs) {
    if (pc.status === "canceled") continue
    const payments = pc.payments || []
    if (payments.length > 0) {
      const p = payments[0]
      return {
        providerId: p.provider_id || "",
        method: order.metadata?.payment_method || p.data?.method || "",
        data: p.data || {},
      }
    }
  }
  // Fallback: any payment collection (even canceled)
  for (const pc of pcs) {
    const payments = pc.payments || []
    if (payments.length > 0) {
      const p = payments[0]
      return {
        providerId: p.provider_id || "",
        method: order.metadata?.payment_method || p.data?.method || "",
        data: p.data || {},
      }
    }
  }
  // Fallback for manually created orders: use metadata.payment_provider
  const metaProvider = order.metadata?.payment_provider || ""
  return { providerId: metaProvider ? `pp_${metaProvider}` : "", method: order.metadata?.payment_method || "", data: {} }
}

function isCODOrder(order: any): boolean {
  const { providerId } = findPrimaryPayment(order)
  if (providerId.includes("cod")) return true
  // Fallback: check metadata (survives order edits that cancel payment collections)
  if (order.metadata?.payment_provider === "cod") return true
  if (order.metadata?.payment_method === "cod") return true
  if (order.metadata?.upsell_payment_id === "cod") return true
  return false
}

// Bold COD badge — "COD" text in amber rounded rectangle, visible at all sizes
const COD_ICON_SVG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 28"><rect x="1" y="1" width="46" height="26" rx="5" fill="%238B6914"/><rect x="2" y="2" width="44" height="24" rx="4" fill="none" stroke="%23725610" stroke-width="0.5" opacity="0.3"/><text x="24" y="19.5" font-family="Arial,Helvetica,sans-serif" font-size="14" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="1">COD</text></svg>')}`

export function getPaymentIconUrl(order: any): string {
  // COD detection first (check across all PCs + metadata)
  if (isCODOrder(order)) return COD_ICON_SVG

  const { providerId, method, data } = findPrimaryPayment(order)

  if (providerId.includes("klarna")) return `${ICON_BASE}/apm/klarna.svg`
  if (providerId.includes("paypal")) return `${ICON_BASE}/apm/paypal.svg`

  // Stripe — map method to specific icon
  if (providerId.includes("stripe")) {
    const m = (method || "").toLowerCase()
    if (m === "blik") return BLIK_SVG
    if (m === "przelewy24") return P24_SVG

    const map: Record<string, string> = {
      card: "cards/visa.svg",
      creditcard: "cards/visa.svg",
      ideal: "apm/ideal.svg",
      bancontact: "apm/bancontact.svg",
      klarna: "apm/klarna.svg",
      eps: "apm/eps.svg",
      p24: "apm/przelewy24.svg",
      sepa_debit: "apm/sepa.svg",
      sofort: "apm/sofort.svg",
      applepay: "wallets/apple-pay.svg",
      googlepay: "wallets/google-pay.svg",
      revolut_pay: "apm/revolut.svg",
      paypal: "apm/paypal.svg",
    }
    return `${ICON_BASE}/${map[m] || "cards/visa.svg"}`
  }

  // Airwallex — map method to specific icon
  if (providerId.includes("airwallex")) {
    // Methods that use custom SVGs (not in datatrans repo)
    const m = (method || "").toLowerCase()
    if (m === "blik") return BLIK_SVG
    if (m === "przelewy24" || m === "p24") return P24_SVG
    if (m === "payu") return PAYU_SVG
    if (m === "trustly") return TRUSTLY_SVG

    const map: Record<string, string> = {
      card: "cards/visa.svg",
      creditcard: "cards/visa.svg",
      ideal: "apm/ideal.svg",
      bancontact: "apm/bancontact.svg",
      eps: "apm/eps.svg",
      klarna: "apm/klarna.svg",
      paypal: "apm/paypal.svg",
      applepay: "wallets/apple-pay.svg",
      googlepay: "wallets/google-pay.svg",
      sofort: "apm/sofort.svg",
    }
    return `${ICON_BASE}/${map[m] || "cards/visa.svg"}`
  }

  // Mollie — map method to specific icon
  if (providerId.includes("mollie")) {
    const m = (method || "").toLowerCase()
    if (m === "blik") return BLIK_SVG
    if (m === "przelewy24" || m === "p24") return P24_SVG

    const map: Record<string, string> = {
      ideal: "apm/ideal.svg",
      bancontact: "apm/bancontact.svg",
      creditcard: "cards/visa.svg",
      card: "cards/visa.svg",
      eps: "apm/eps.svg",
      klarna: "apm/klarna.svg",
      sofort: "apm/sofort.svg",
      applepay: "wallets/apple-pay.svg",
      googlepay: "wallets/google-pay.svg",
      paypal: "apm/paypal.svg",
    }
    return `${ICON_BASE}/${map[m] || "apm/ideal.svg"}`
  }

  // Comgate — map method to specific icon
  if (providerId.includes("comgate")) {
    const m = method || data?.comgate_method || ""
    if (m.includes("CARD") || m === "creditcard" || m === "card") return `${ICON_BASE}/cards/visa.svg`
    if (m.includes("APPLEPAY") || m === "applepay") return `${ICON_BASE}/wallets/apple-pay.svg`
    if (m.includes("GPAY") || m.includes("GOOGLEPAY") || m === "googlepay") return `${ICON_BASE}/wallets/google-pay.svg`
    if (m.includes("BANK")) return BANK_CZ_SVG
    if (m === "bank_transfer") return BANK_CZ_SVG
    if (m.includes("LATER") || m.includes("PART") || m.includes("LOAN") || m.includes("SKIPPAY") || m.includes("PLATIMPAK")) return `${ICON_BASE}/apm/klarna.svg`
    if (m.includes("TWISTO")) return `${ICON_BASE}/apm/klarna.svg`
    // Default: bank icon for Comgate
    return BANK_CZ_SVG
  }

  // Przelewy24
  if (providerId.includes("przelewy") || providerId.includes("p24")) {
    return `${ICON_BASE}/apm/przelewy24.svg`
  }

  return ""
}

export function getPaymentFallback(order: any): { letter: string; bg: string; color: string } {
  if (isCODOrder(order)) return { letter: "COD", bg: "#8B6914", color: "#fff" }
  const { providerId } = findPrimaryPayment(order)
  if (providerId.includes("stripe")) return { letter: "S", bg: "#635BFF", color: "#fff" }
  if (providerId.includes("airwallex")) return { letter: "AW", bg: "#FF5100", color: "#fff" }
  if (providerId.includes("comgate")) return { letter: "C", bg: "#444", color: "#fff" }
  if (providerId.includes("przelewy") || providerId.includes("p24")) return { letter: "P24", bg: "#D40E2F", color: "#fff" }
  return { letter: "?", bg: colors.textMuted, color: "#fff" }
}

export function getPaymentMethodName(order: any): string {
  if (isCODOrder(order)) return "Dobírka (COD)"
  const { providerId, method } = findPrimaryPayment(order)
  if (providerId.includes("klarna")) return "Klarna"
  if (providerId.includes("paypal")) return "PayPal"
  if (providerId.includes("comgate")) {
    const m = method || ""
    const names: Record<string, string> = {
      // Card
      "CARD_CZ_COMGATE": "Platba kartou",
      "creditcard": "Platba kartou",
      "card": "Platba kartou",
      // Banks PSD2
      "BANK_CZ_CS_PSD2": "Česká spořitelna",
      "BANK_CZ_CSOB_PSD2": "ČSOB",
      "BANK_CZ_KB_PSD2": "Komerční banka",
      "BANK_CZ_RB_PSD2": "Raiffeisenbank",
      "BANK_CZ_FB_PSD2": "Fio banka",
      "BANK_CZ_MB_PSD2": "mBank",
      "BANK_CZ_AB_PSD2": "Air Bank",
      "BANK_CZ_AB_CVAK": "Air Bank Cvak",
      "BANK_CZ_MO_PSD2": "Moneta Money Bank",
      "BANK_CZ_UC_PSD2": "UniCredit Bank",
      "BANK_CZ_PB_PSD2": "Partners Banka",
      "BANK_CZ_OTHER": "Bankovní převod",
      // Legacy codes (backwards compat)
      "BANK_CZ_CS_P": "Česká spořitelna",
      "BANK_CZ_CSOB_P": "ČSOB",
      "BANK_CZ_KB": "Komerční banka",
      "BANK_CZ_RB": "Raiffeisenbank",
      "BANK_CZ_FB": "Fio banka",
      "BANK_CZ_MB_P": "mBank",
      "BANK_CZ_AB": "Air Bank",
      "BANK_CZ_GE": "Moneta Money Bank",
      "BANK_ALL": "Bankovní převod",
      "bank_transfer": "Bankovní převod",
      // Other
      "APPLEPAY_REDIRECT": "Apple Pay",
      "applepay": "Apple Pay",
      "GPAY_REDIRECT": "Google Pay",
      "googlepay": "Google Pay",
      "LATER_TWISTO": "Twisto",
      "LATER_SKIPPAY": "Skip Pay",
      "LATER_PLATIMPAK": "PlatímPak",
    }
    return names[m] || "Comgate"
  }
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
      blik: "BLIK",
      przelewy24: "Przelewy24",
      p24: "Przelewy24",
      payu: "PayU",
      eps: "EPS",
      klarna: "Klarna",
      paypal: "PayPal",
      trustly: "Trustly",
      sofort: "Sofort",
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
