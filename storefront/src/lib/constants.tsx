import React from "react"
import { CreditCard } from "@medusajs/icons"

import Ideal from "@modules/common/icons/ideal"
import Bancontact from "@modules/common/icons/bancontact"
import PayPal from "@modules/common/icons/paypal"
import Klarna from "@modules/common/icons/klarna"
import ApplePay from "@modules/common/icons/applepay"
import GooglePay from "@modules/common/icons/googlepay"

/* Map of payment provider_id to their title and icon. Add in any payment providers you want to use. */
export const paymentInfoMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  pp_stripe_stripe: {
    title: "Credit card",
    icon: <CreditCard />,
  },
  "pp_stripe-ideal_stripe": {
    title: "iDeal",
    icon: <Ideal />,
  },
  "pp_stripe-bancontact_stripe": {
    title: "Bancontact",
    icon: <Bancontact />,
  },
  pp_paypal_paypal: {
    title: "PayPal",
    icon: <PayPal />,
  },
  pp_system_default: {
    title: "Manual Payment",
    icon: <CreditCard />,
  },
  // Custom payment gateways
  pp_mollie_mollie: {
    title: "Mollie",
    icon: <CreditCard />,
  },
  pp_comgate_comgate: {
    title: "Comgate",
    icon: <CreditCard />,
  },
  pp_przelewy24_przelewy24: {
    title: "Przelewy24",
    icon: <CreditCard />,
  },
  pp_klarna_klarna: {
    title: "Klarna",
    icon: <Klarna />,
  },
  pp_airwallex_airwallex: {
    title: "Airwallex",
    icon: <CreditCard />,
  },
  pp_novalnet_novalnet: {
    title: "Novalnet",
    icon: <CreditCard />,
  },
}

/**
 * Map of payment method codes to their display name and icon.
 * Used for dynamic payment method rendering in checkout components.
 */
export const paymentMethodIconMap: Record<
  string,
  { title: string; icon: React.JSX.Element }
> = {
  creditcard: { title: "Credit Card", icon: <CreditCard /> },
  ideal: { title: "iDEAL", icon: <Ideal /> },
  bancontact: { title: "Bancontact", icon: <Bancontact /> },
  klarna: { title: "Klarna", icon: <Klarna /> },
  klarnapaylater: { title: "Klarna", icon: <Klarna /> },
  klarnasliceit: { title: "Klarna", icon: <Klarna /> },
  paypal: { title: "PayPal", icon: <PayPal /> },
  applepay: { title: "Apple Pay", icon: <ApplePay /> },
  googlepay: { title: "Google Pay", icon: <GooglePay /> },
  eps: { title: "EPS", icon: <CreditCard /> },
  blik: { title: "BLIK", icon: <CreditCard /> },
  przelewy24: { title: "Przelewy24", icon: <CreditCard /> },
  in3: { title: "in3", icon: <CreditCard /> },
  belfius: { title: "Belfius", icon: <CreditCard /> },
  kbc: { title: "KBC/CBC", icon: <CreditCard /> },
  riverty: { title: "Riverty", icon: <CreditCard /> },
  trustly: { title: "Trustly", icon: <CreditCard /> },
  bank_transfer: { title: "Bank Transfer", icon: <CreditCard /> },
  sepa_debit: { title: "SEPA Direct Debit", icon: <CreditCard /> },
}

// This only checks if it is native stripe for card payments, it ignores the other stripe-based providers
export const isStripe = (providerId?: string) => {
  return providerId?.startsWith("pp_stripe_")
}
export const isPaypal = (providerId?: string) => {
  return providerId?.startsWith("pp_paypal")
}
export const isManual = (providerId?: string) => {
  return providerId?.startsWith("pp_system_default")
}
export const isMollie = (providerId?: string) => {
  return providerId?.startsWith("pp_mollie")
}
export const isComgate = (providerId?: string) => {
  return providerId?.startsWith("pp_comgate")
}
export const isP24 = (providerId?: string) => {
  return providerId?.startsWith("pp_przelewy24")
}
export const isKlarna = (providerId?: string) => {
  return providerId?.startsWith("pp_klarna")
}
export const isAirwallex = (providerId?: string) => {
  return providerId?.startsWith("pp_airwallex")
}
export const isNovalnet = (providerId?: string) => {
  return providerId?.startsWith("pp_novalnet")
}
export const isRedirectPayment = (providerId?: string) => {
  // Novalnet methods are mostly redirect-based (iDEAL, Bancontact, PayPal,
  // Przelewy24, eps, Trustly, ...) — the redirect URL comes back in
  // payment session data as `redirectUrl`. CreditCard + SEPA are inline.
  return isMollie(providerId) || isComgate(providerId) || isP24(providerId) || isNovalnet(providerId)
  // Klarna is NOT a redirect method — it has its own widget flow (init → load → authorize)
}

// Add currencies that don't need to be divided by 100
export const noDivisionCurrencies = [
  "krw",
  "jpy",
  "vnd",
  "clp",
  "pyg",
  "xaf",
  "xof",
  "bif",
  "djf",
  "gnf",
  "kmf",
  "mga",
  "rwf",
  "xpf",
  "htg",
  "vuv",
  "xag",
  "xdr",
  "xau",
]
