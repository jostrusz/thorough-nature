import React from "react"
import { CreditCard } from "@medusajs/icons"

import Ideal from "@modules/common/icons/ideal"
import Bancontact from "@modules/common/icons/bancontact"
import PayPal from "@modules/common/icons/paypal"

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
    icon: <CreditCard />,
  },
  pp_airwallex_airwallex: {
    title: "Airwallex",
    icon: <CreditCard />,
  },
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
export const isRedirectPayment = (providerId?: string) => {
  return isMollie(providerId) || isComgate(providerId) || isP24(providerId) || isKlarna(providerId)
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
