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
    case "payu":
      return <div style={{ ...style, background: "#A6C307", color: "#FFFFFF" }}>PayU</div>
    case "applepay":
    case "apple_pay":
      return <div style={{ ...style, background: "#000000", color: "#FFFFFF" }}>{"\uF8FF"} Pay</div>
    case "googlepay":
    case "google_pay":
      return <div style={{ ...style, background: "#FFFFFF", color: "#4285F4" }}>G Pay</div>
    case "barion":
    case "wallet":
      return <div style={{ ...style, background: "#0097DB", color: "#FFFFFF" }}>Barion</div>
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
    // Czech banks (Comgate PSD2 bank buttons)
    case "bank_cz_cs":
      return <div style={{ ...style, background: "#2870C8", color: "#FFFFFF" }}>ČS</div>
    case "bank_cz_csob":
      return <div style={{ ...style, background: "#0099D8", color: "#FFFFFF" }}>ČSOB</div>
    case "bank_cz_kb":
      return <div style={{ ...style, background: "#E4002B", color: "#FFFFFF" }}>KB</div>
    case "bank_cz_rb":
      return <div style={{ ...style, background: "#FFE600", color: "#000000" }}>RB</div>
    case "bank_cz_mo":
      return <div style={{ ...style, background: "#6E2C8F", color: "#FFFFFF" }}>MO</div>
    case "bank_cz_fb":
      return <div style={{ ...style, background: "#1F9CD7", color: "#FFFFFF" }}>FIO</div>
    case "bank_cz_mb":
      return <div style={{ ...style, background: "#E90A0A", color: "#FFFFFF" }}>mB</div>
    case "bank_cz_ab":
      return <div style={{ ...style, background: "#92C83E", color: "#FFFFFF" }}>AB</div>
    case "bank_cz_pb":
      return <div style={{ ...style, background: "#0E1B2C", color: "#3DF2C3" }}>PB</div>
    case "bank_cz_uc":
      return <div style={{ ...style, background: "#E2001A", color: "#FFFFFF" }}>UC</div>
    case "bank_cz_other":
      return <div style={{ ...style, background: "#F6F6F7", color: "#1A1A1A" }}>Bank</div>
    // Slovak banks (Comgate PSD2 bank buttons)
    case "bank_sk_slsp":
      return <div style={{ ...style, background: "#0067B1", color: "#FFFFFF" }}>SLSP</div>
    case "bank_sk_tb":
      return <div style={{ ...style, background: "#0088CE", color: "#FFFFFF" }}>TB</div>
    case "bank_sk_vub":
      return <div style={{ ...style, background: "#E30613", color: "#FFFFFF" }}>VÚB</div>
    case "bank_sk_csob":
      return <div style={{ ...style, background: "#0099D8", color: "#FFFFFF" }}>ČSOB</div>
    case "bank_sk_365":
      return <div style={{ ...style, background: "#E52713", color: "#FFFFFF" }}>365</div>
    case "bank_sk_fb":
      return <div style={{ ...style, background: "#1F9CD7", color: "#FFFFFF" }}>FIO</div>
    case "bank_sk_mb":
      return <div style={{ ...style, background: "#E90A0A", color: "#FFFFFF" }}>mB</div>
    case "bank_sk_pb":
      return <div style={{ ...style, background: "#C8102E", color: "#FFFFFF" }}>PB</div>
    case "bank_sk_uc":
      return <div style={{ ...style, background: "#E2001A", color: "#FFFFFF" }}>UC</div>
    case "qrcz":
      return <div style={{ ...style, background: "#000000", color: "#FFFFFF" }}>QR</div>
    // Czech BNPL / deferred payments
    case "twisto":
    case "twisto_part":
      return <div style={{ ...style, background: "#00ABEB", color: "#FFFFFF" }}>Twisto</div>
    case "skippay":
    case "skippay_part":
      return <div style={{ ...style, background: "#5A2EE5", color: "#FFFFFF" }}>Skip</div>
    case "platimpak":
      return <div style={{ ...style, background: "#0A2342", color: "#FFFFFF" }}>PPak</div>
    case "cofidis":
      return <div style={{ ...style, background: "#C8003C", color: "#FFFFFF" }}>COF</div>
    case "homecredit":
      return <div style={{ ...style, background: "#E30613", color: "#FFFFFF" }}>HC</div>
    case "essox":
    case "essox_part":
      return <div style={{ ...style, background: "#004B93", color: "#FFFFFF" }}>ESX</div>
    case "pay_by_bank":
    case "brite":
      return <div style={{ ...style, background: "#FFE600", color: "#0A0B09" }}>Brite</div>
    case "swish":
      return <div style={{ ...style, background: "#EB4B97", color: "#FFFFFF" }}>Swish</div>
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
    { code: "blik", name: "BLIK", icon: "blik", available_countries: ["pl"], supported_currencies: ["PLN"] },
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
    { code: "przelewy24", name: "Przelewy24", icon: "przelewy24", available_countries: ["pl"], supported_currencies: ["PLN", "EUR"] },
    { code: "payu", name: "PayU", icon: "payu", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "eps", name: "EPS", icon: "eps", available_countries: ["at"], supported_currencies: ["EUR"] },
    { code: "klarna", name: "Klarna", icon: "klarna", available_countries: ["nl", "be", "de", "at", "fi", "fr", "it", "se", "es", "dk", "no", "gb", "ie"], supported_currencies: [] },
    { code: "paypal", name: "PayPal", icon: "paypal", available_countries: [], supported_currencies: ["EUR", "USD", "GBP", "AUD", "CAD", "JPY", "PLN", "SEK", "CZK", "HUF"] },
    { code: "googlepay", name: "Google Pay", icon: "googlepay", available_countries: [], supported_currencies: [] },
    { code: "applepay", name: "Apple Pay", icon: "applepay", available_countries: [], supported_currencies: [] },
  ],
  comgate: [
    { code: "creditcard", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "bank_transfer", name: "Bank Transfer (CZ banks group)", icon: "bank_transfer", available_countries: [], supported_currencies: ["CZK", "EUR"] },
    { code: "applepay", name: "Apple Pay", icon: "applepay", available_countries: [], supported_currencies: [] },
    { code: "googlepay", name: "Google Pay", icon: "googlepay", available_countries: [], supported_currencies: [] },
    // Individual CZ bank buttons (PSD2) — rendered inside the bank_transfer group on checkout
    { code: "bank_cz_cs", name: "Česká spořitelna", icon: "bank_cz_cs", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_csob", name: "ČSOB", icon: "bank_cz_csob", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_kb", name: "Komerční banka", icon: "bank_cz_kb", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_rb", name: "Raiffeisenbank", icon: "bank_cz_rb", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_mo", name: "Moneta Money Bank", icon: "bank_cz_mo", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_fb", name: "Fio banka", icon: "bank_cz_fb", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_mb", name: "mBank", icon: "bank_cz_mb", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_ab", name: "Air Bank", icon: "bank_cz_ab", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_pb", name: "Partners Banka", icon: "bank_cz_pb", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_uc", name: "UniCredit Bank", icon: "bank_cz_uc", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "bank_cz_other", name: "Jiná banka (převod)", icon: "bank_transfer", available_countries: ["cz"], supported_currencies: ["CZK"] },
    // Individual SK bank buttons (PSD2, EUR) — rendered inside the bank group on the SK checkout
    { code: "bank_sk_slsp", name: "Slovenská sporiteľňa", icon: "bank_sk_slsp", available_countries: ["sk"], supported_currencies: ["EUR"] },
    { code: "bank_sk_tb", name: "Tatra banka", icon: "bank_sk_tb", available_countries: ["sk"], supported_currencies: ["EUR"] },
    { code: "bank_sk_vub", name: "VÚB banka", icon: "bank_sk_vub", available_countries: ["sk"], supported_currencies: ["EUR"] },
    { code: "bank_sk_csob", name: "ČSOB", icon: "bank_sk_csob", available_countries: ["sk"], supported_currencies: ["EUR"] },
    { code: "bank_sk_365", name: "365.bank", icon: "bank_sk_365", available_countries: ["sk"], supported_currencies: ["EUR"] },
    { code: "bank_sk_fb", name: "Fio banka", icon: "bank_sk_fb", available_countries: ["sk"], supported_currencies: ["EUR"] },
    { code: "bank_sk_mb", name: "mBank", icon: "bank_sk_mb", available_countries: ["sk"], supported_currencies: ["EUR"] },
    { code: "bank_sk_pb", name: "Prima banka", icon: "bank_sk_pb", available_countries: ["sk"], supported_currencies: ["EUR"] },
    { code: "bank_sk_uc", name: "UniCredit Bank", icon: "bank_sk_uc", available_countries: ["sk"], supported_currencies: ["EUR"] },
    { code: "bank_sk_other", name: "Iná banka (prevod)", icon: "bank_transfer", available_countries: ["sk"], supported_currencies: ["EUR"] },
    // Deferred payments / BNPL (must be enabled on the Comgate merchant account)
    { code: "twisto", name: "Twisto — platba do 30 dnů", icon: "twisto", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "skippay", name: "Skip Pay — odložená platba", icon: "skippay", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "platimpak", name: "PlatímPak — odložená platba", icon: "platimpak", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "twisto_part", name: "Twisto — na třetiny", icon: "twisto", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "skippay_part", name: "Skip Pay — na třetiny", icon: "skippay", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "essox_part", name: "ESSOX — rozložená platba", icon: "essox", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "cofidis", name: "Cofidis — splátky", icon: "cofidis", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "homecredit", name: "Home Credit — splátky", icon: "homecredit", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "essox", name: "ESSOX — splátky", icon: "essox", available_countries: ["cz"], supported_currencies: ["CZK"] },
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
  payu: [
    // BLIK & cards (always-on highlights for PL)
    { code: "blik", name: "BLIK", icon: "blik", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "c", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: ["PLN", "EUR", "CZK", "RON", "HUF", "BGN", "USD", "GBP"] },
    // Wallets
    { code: "jp", name: "Google Pay", icon: "googlepay", available_countries: ["pl"], supported_currencies: ["PLN", "EUR"] },
    { code: "ap", name: "Apple Pay", icon: "applepay", available_countries: ["pl"], supported_currencies: ["PLN", "EUR"] },
    // Polish Pay-By-Link bank methods
    { code: "m", name: "mBank (mTransfer)", icon: "bank_transfer", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "i", name: "ING Bank Śląski", icon: "bank_transfer", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "o", name: "Pekao24", icon: "bank_transfer", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "s", name: "Santander", icon: "bank_transfer", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "pkb", name: "PKO BP (iPKO)", icon: "bank_transfer", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "inteligo", name: "Inteligo", icon: "bank_transfer", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "bos", name: "BOŚ Bank", icon: "bank_transfer", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "dpt", name: "Traditional Transfer", icon: "bank_transfer", available_countries: ["pl"], supported_currencies: ["PLN"] },
    // Installments / BNPL
    { code: "ai", name: "Raty PayU (Installments)", icon: "klarna", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "twi", name: "Twisto / PayPo (BNPL)", icon: "klarna", available_countries: ["pl"], supported_currencies: ["PLN"] },
    { code: "wt", name: "PayU Pay Later", icon: "klarna", available_countries: ["pl"], supported_currencies: ["PLN"] },
    // Czech pay-by-link methods (CZK POS) — codes from GET /api/v2_1/paymethods
    { code: "qrcz", name: "QR platba", icon: "qrcz", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "cs", name: "Česká spořitelna", icon: "bank_cz_cs", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "kb", name: "Komerční banka", icon: "bank_cz_kb", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "cb", name: "ČSOB", icon: "bank_cz_csob", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "mp", name: "mBank (mTransfer CZ)", icon: "bank_cz_mb", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "pf", name: "Fio banka", icon: "bank_cz_fb", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "pg", name: "Moneta Money Bank", icon: "bank_cz_mo", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "rf", name: "Raiffeisenbank ePlatby", icon: "bank_cz_rb", available_countries: ["cz"], supported_currencies: ["CZK"] },
    { code: "uc", name: "UniCredit", icon: "bank_cz_uc", available_countries: ["cz"], supported_currencies: ["CZK"] },
  ],
  novalnet: [
    { code: "creditcard", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "sepa", name: "SEPA Direct Debit", icon: "sepa", available_countries: ["nl", "be", "de", "at", "fi", "fr", "it", "es", "ie", "pt", "lu", "sk"], supported_currencies: ["EUR"] },
    { code: "ideal", name: "iDEAL", icon: "ideal", available_countries: ["nl"], supported_currencies: ["EUR"] },
    { code: "bancontact", name: "Bancontact", icon: "bancontact", available_countries: ["be"], supported_currencies: ["EUR"] },
    { code: "eps", name: "EPS", icon: "eps", available_countries: ["at"], supported_currencies: ["EUR"] },
    { code: "paypal", name: "PayPal", icon: "paypal", available_countries: [], supported_currencies: [] },
    { code: "przelewy24", name: "Przelewy24", icon: "przelewy24", available_countries: ["pl"], supported_currencies: ["PLN", "EUR"] },
    { code: "giropay", name: "Giropay", icon: "giropay", available_countries: ["de"], supported_currencies: ["EUR"] },
    { code: "online_transfer", name: "Sofort / Online Bank Transfer", icon: "bank_transfer", available_countries: ["de", "at", "ch", "be", "nl", "it", "es", "pl"], supported_currencies: ["EUR", "PLN"] },
    { code: "trustly", name: "Trustly", icon: "trustly", available_countries: ["nl", "be", "de", "fr", "fi", "se", "no", "dk", "ee", "lt", "lv"], supported_currencies: ["EUR"] },
    { code: "postfinance", name: "PostFinance E-Finance", icon: "bank_transfer", available_countries: ["ch"], supported_currencies: ["CHF", "EUR"] },
    { code: "postfinance_card", name: "PostFinance Card", icon: "card", available_countries: ["ch"], supported_currencies: ["CHF", "EUR"] },
    { code: "multibanco", name: "Multibanco", icon: "bank_transfer", available_countries: ["pt"], supported_currencies: ["EUR"] },
    { code: "invoice", name: "Invoice (Pay later)", icon: "bank_transfer", available_countries: ["de", "at", "ch"], supported_currencies: ["EUR", "CHF"] },
    { code: "prepayment", name: "Prepayment", icon: "bank_transfer", available_countries: ["de", "at", "ch"], supported_currencies: ["EUR", "CHF"] },
    { code: "cashpayment", name: "Barzahlen / viacash", icon: "bank_transfer", available_countries: ["de", "at"], supported_currencies: ["EUR"] },
  ],
  brite: [
    // Brite is "Pay by Bank" — a single logical method that fans out into per-bank
    // tiles on the storefront. We surface the umbrella method here so admins can
    // enable it; the actual bank list is sourced from the Brite Service
    // Presentation API and cached in `brite_bank_logo`.
    { code: "pay_by_bank", name: "Pay by Bank (Open Banking)", icon: "bank_transfer", available_countries: ["nl", "be", "de", "lu", "se", "no", "gb", "fi", "dk", "ee", "lt", "lv", "ie", "fr", "it", "es", "pt", "at", "pl"], supported_currencies: ["EUR", "SEK", "NOK", "DKK", "GBP", "PLN"] },
    { code: "swish", name: "Swish (SE)", icon: "swish", available_countries: ["se"], supported_currencies: ["SEK"] },
    { code: "ideal", name: "iDEAL (NL via Brite)", icon: "ideal", available_countries: ["nl"], supported_currencies: ["EUR"] },
  ],
  barion: [
    // Barion Smart Gateway (redirect). Each method restricts the FundingSources
    // on the hosted page; codes map in payment-barion/service.ts FUNDING_MAP.
    // Currencies: HUF/CZK/EUR/PLN/RON (no SEK). Bank transfer discontinued 2026-01-09.
    { code: "card", name: "Bankkártya (Card)", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "applepay", name: "Apple Pay", icon: "applepay", available_countries: [], supported_currencies: [] },
    { code: "googlepay", name: "Google Pay", icon: "googlepay", available_countries: [], supported_currencies: [] },
    { code: "wallet", name: "Barion egyenleg (Pénztárca)", icon: "barion", available_countries: [], supported_currencies: [] },
  ],
  revolut: [
    // Revolut Merchant — all methods render INLINE via the Web SDK against the
    // order token (no redirect). card / apple_pay / google_pay / revolut_pay work
    // broadly (incl. CZK); pay_by_bank per open-banking coverage; sepa EUR only.
    { code: "card", name: "Credit/Debit Card", icon: "card", available_countries: [], supported_currencies: [] },
    { code: "revolut_pay", name: "Revolut Pay", icon: "revolut", available_countries: [], supported_currencies: [] },
    { code: "apple_pay", name: "Apple Pay", icon: "applepay", available_countries: [], supported_currencies: [] },
    { code: "google_pay", name: "Google Pay", icon: "googlepay", available_countries: [], supported_currencies: [] },
    { code: "pay_by_bank", name: "Pay by Bank", icon: "bank_transfer", available_countries: ["gb", "ie", "nl", "be", "de", "at", "fr", "it", "es", "pt", "fi", "ee", "lt", "lv", "pl", "se", "no", "dk"], supported_currencies: ["EUR", "GBP", "SEK", "NOK", "DKK", "PLN"] },
    { code: "sepa_direct_debit", name: "SEPA Direct Debit", icon: "sepa", available_countries: ["at", "be", "cy", "de", "ee", "es", "fi", "fr", "gr", "ie", "it", "lt", "lu", "lv", "mt", "nl", "pt", "si", "sk"], supported_currencies: ["EUR"] },
  ],
  bank_transfer: [
    // Manual SEPA credit transfer with EPC/SEPA QR. Customer pays from their own
    // bank to our IBAN using an RF reference; reconciled by the FIO cron. EUR only.
    { code: "sepa", name: "Bankový prevod (SEPA QR)", icon: "bank_transfer", available_countries: ["sk", "cz", "at", "be", "de", "ee", "es", "fi", "fr", "gr", "ie", "it", "lt", "lu", "lv", "mt", "nl", "pt", "si"], supported_currencies: ["EUR"] },
  ],
}

export const SUPPORTED_PROVIDERS = [
  { code: "stripe", name: "Stripe" },
  { code: "mollie", name: "Mollie" },
  { code: "airwallex", name: "Airwallex" },
  { code: "brite", name: "Brite Payments (Pay by Bank)" },
  { code: "comgate", name: "Comgate" },
  { code: "przelewy24", name: "Przelewy24" },
  { code: "payu", name: "PayU" },
  { code: "paypal", name: "PayPal" },
  { code: "klarna", name: "Klarna" },
  { code: "novalnet", name: "Novalnet" },
  { code: "barion", name: "Barion" },
  { code: "revolut", name: "Revolut (Merchant)" },
  { code: "bank_transfer", name: "Bank Transfer (SEPA QR)" },
]

export const SUPPORTED_CURRENCIES = ["EUR", "CZK", "PLN", "SEK", "NOK", "HUF"]
