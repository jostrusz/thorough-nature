import React from "react"
import { CreditCard } from "@medusajs/icons"
import Ideal from "@modules/common/icons/ideal"
import Bancontact from "@modules/common/icons/bancontact"
import PayPal from "@modules/common/icons/paypal"
import Klarna from "@modules/common/icons/klarna"
import ApplePay from "@modules/common/icons/applepay"
import GooglePay from "@modules/common/icons/googlepay"

/**
 * Get the icon component for a payment method code.
 * Used by both the payment-method-selector and payment display components.
 */
export function getPaymentMethodIcon(
  methodCode: string,
  size = "20"
): React.JSX.Element {
  const code = methodCode.toLowerCase()

  switch (code) {
    case "ideal":
      return <Ideal size={size} />
    case "bancontact":
      return <Bancontact size={size} />
    case "klarna":
    case "klarnapaylater":
    case "klarnasliceit":
      return <Klarna size={size} />
    case "paypal":
      return <PayPal />
    case "applepay":
    case "apple_pay":
      return <ApplePay size={size} />
    case "googlepay":
    case "google_pay":
      return <GooglePay size={size} />
    case "creditcard":
    case "card":
    case "visa":
    case "mastercard":
      return <CreditCard />
    default:
      return <CreditCard />
  }
}
