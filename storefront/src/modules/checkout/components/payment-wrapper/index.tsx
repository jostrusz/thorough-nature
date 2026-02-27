"use client"

import { loadStripe } from "@stripe/stripe-js"
import React from "react"
import StripeWrapper from "./stripe-wrapper"
import MollieWrapper from "./mollie-wrapper"
import { PayPalScriptProvider } from "@paypal/react-paypal-js"
import { createContext } from "react"
import { HttpTypes } from "@medusajs/types"
import { isMollie, isPaypal, isStripe } from "@lib/constants"

type WrapperProps = {
  cart: HttpTypes.StoreCart
  children: React.ReactNode
}

export const StripeContext = createContext(false)
export const MollieCardContext = createContext(false)

const stripeKey = process.env.NEXT_PUBLIC_STRIPE_KEY
const stripePromise = stripeKey ? loadStripe(stripeKey) : null

const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID
const mollieProfileId = process.env.NEXT_PUBLIC_MOLLIE_PROFILE_ID
const mollieTestmode = process.env.NEXT_PUBLIC_MOLLIE_TESTMODE === "true"

const Wrapper: React.FC<WrapperProps> = ({ cart, children }) => {
  const paymentSession = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  if (
    isStripe(paymentSession?.provider_id) &&
    paymentSession &&
    stripePromise
  ) {
    return (
      <StripeContext.Provider value={true}>
        <StripeWrapper
          paymentSession={paymentSession}
          stripeKey={stripeKey}
          stripePromise={stripePromise}
        >
          {children}
        </StripeWrapper>
      </StripeContext.Provider>
    )
  }

  if (
    isMollie(paymentSession?.provider_id) &&
    mollieProfileId &&
    paymentSession?.data?.method === "creditcard"
  ) {
    return (
      <MollieCardContext.Provider value={true}>
        <MollieWrapper
          profileId={mollieProfileId}
          testmode={mollieTestmode}
          locale={cart?.region?.countries?.[0]?.iso_2 === "nl" ? "nl_NL" : "en_US"}
        >
          {children}
        </MollieWrapper>
      </MollieCardContext.Provider>
    )
  }

  if (
    isPaypal(paymentSession?.provider_id) &&
    paypalClientId !== undefined &&
    cart
  ) {
    return (
      <PayPalScriptProvider
        options={{
          "client-id": process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || "test",
          currency: cart?.currency_code.toUpperCase(),
          intent: "authorize",
          components: "buttons",
        }}
      >
        {children}
      </PayPalScriptProvider>
    )
  }

  return <div>{children}</div>
}

export default Wrapper
