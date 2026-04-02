"use client"

import { Button } from "@medusajs/ui"
import { OnApproveActions, OnApproveData } from "@paypal/paypal-js"
import { PayPalButtons, usePayPalScriptReducer } from "@paypal/react-paypal-js"
import { useElements, useStripe } from "@stripe/react-stripe-js"
import React, { useState } from "react"
import ErrorMessage from "../error-message"
import Spinner from "@modules/common/icons/spinner"
import { placeOrder, updateCartAddresses } from "@lib/data/cart"
import { HttpTypes } from "@medusajs/types"
import { isManual, isMollie, isPaypal, isStripe, isKlarna } from "@lib/constants"
import { useMollie } from "../payment-wrapper/mollie-wrapper"
import { KlarnaPaymentButton } from "../klarna-payment-button"

type PaymentButtonProps = {
  cart: HttpTypes.StoreCart
  "data-testid": string
}

const PaymentButton: React.FC<PaymentButtonProps> = ({
  cart,
  "data-testid": dataTestId,
}) => {
  const notReady =
    !cart ||
    !cart.shipping_address ||
    !cart.billing_address ||
    !cart.email ||
    (cart.shipping_methods?.length ?? 0) < 1

  // TODO: Add this once gift cards are implemented
  // const paidByGiftcard =
  //   cart?.gift_cards && cart?.gift_cards?.length > 0 && cart?.total === 0

  // if (paidByGiftcard) {
  //   return <GiftCardPaymentButton />
  // }

  const paymentSession = cart.payment_collection?.payment_sessions?.[0]

  switch (true) {
    case isStripe(paymentSession?.provider_id):
      return (
        <StripePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isManual(paymentSession?.provider_id):
      return (
        <ManualTestPaymentButton notReady={notReady} data-testid={dataTestId} />
      )
    case isPaypal(paymentSession?.provider_id):
      return (
        <PayPalPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isMollie(paymentSession?.provider_id):
      return (
        <MolliePaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    case isKlarna(paymentSession?.provider_id):
      return (
        <KlarnaPaymentButton
          notReady={notReady}
          cart={cart}
          data-testid={dataTestId}
        />
      )
    default:
      return <Button disabled>Select a payment method</Button>
  }
}

const GiftCardPaymentButton = () => {
  const [submitting, setSubmitting] = useState(false)

  const handleOrder = async () => {
    setSubmitting(true)
    await placeOrder()
  }

  return (
    <Button
      onClick={handleOrder}
      isLoading={submitting}
      data-testid="submit-order-button"
    >
      Place order
    </Button>
  )
}

const StripePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const stripe = useStripe()
  const elements = useElements()
  const card = elements?.getElement("card")

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const disabled = !stripe || !elements ? true : false

  const handlePayment = async () => {
    setSubmitting(true)

    if (!stripe || !elements || !card || !cart) {
      setSubmitting(false)
      return
    }

    await stripe
      .confirmCardPayment(session?.data.client_secret as string, {
        payment_method: {
          card: card,
          billing_details: {
            name:
              cart.billing_address?.first_name +
              " " +
              cart.billing_address?.last_name,
            address: {
              city: cart.billing_address?.city ?? undefined,
              country: cart.billing_address?.country_code ?? undefined,
              line1: cart.billing_address?.address_1 ?? undefined,
              line2: cart.billing_address?.address_2 ?? undefined,
              postal_code: cart.billing_address?.postal_code ?? undefined,
              state: cart.billing_address?.province ?? undefined,
            },
            email: cart.email,
            phone: cart.billing_address?.phone ?? undefined,
          },
        },
      })
      .then(({ error, paymentIntent }) => {
        if (error) {
          const pi = error.payment_intent

          if (
            (pi && pi.status === "requires_capture") ||
            (pi && pi.status === "succeeded")
          ) {
            onPaymentCompleted()
          }

          setErrorMessage(error.message || null)
          return
        }

        if (
          (paymentIntent && paymentIntent.status === "requires_capture") ||
          paymentIntent.status === "succeeded"
        ) {
          return onPaymentCompleted()
        }

        return
      })
  }

  return (
    <>
      <Button
        disabled={disabled || notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="stripe-payment-error-message"
      />
    </>
  )
}

const PayPalPaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const handlePayment = async (
    _data: OnApproveData,
    actions: OnApproveActions
  ) => {
    try {
      const authorization = await actions?.order?.authorize()
      if (!authorization || authorization.status !== "COMPLETED") {
        setErrorMessage(
          `An error occurred, status: ${authorization?.status}`
        )
        return
      }

      // Extract shipping and billing address from PayPal/Apple Pay payer data
      const payer = authorization.payer
      const shippingInfo =
        (authorization as any).purchase_units?.[0]?.shipping
      const payerAddress = payer?.address
      const shippingAddress = shippingInfo?.address
      const payerName = payer?.name
      const shippingName = shippingInfo?.name?.full_name

      // Use shipping address if available, otherwise fall back to payer address
      const resolvedAddress = shippingAddress || payerAddress
      if (resolvedAddress) {
        // Parse name — shipping name is a single string, payer name is split
        let firstName = ""
        let lastName = ""
        if (shippingName) {
          const parts = shippingName.split(" ")
          firstName = parts[0] || ""
          lastName = parts.slice(1).join(" ") || ""
        } else if (payerName) {
          firstName = payerName.given_name || ""
          lastName = payerName.surname || ""
        }

        const mappedAddress = {
          first_name: firstName,
          last_name: lastName,
          address_1: resolvedAddress.address_line_1 || "",
          address_2: resolvedAddress.address_line_2 || "",
          city: resolvedAddress.admin_area_2 || "",
          province: resolvedAddress.admin_area_1 || "",
          postal_code: resolvedAddress.postal_code || "",
          country_code:
            resolvedAddress.country_code?.toLowerCase() || "",
          phone: (payer as any)?.phone?.phone_number?.national_number || "",
        }

        // Build billing address from payer address if different
        const billingSource = payerAddress || shippingAddress
        const billingAddress = billingSource
          ? {
              first_name: payerName?.given_name || firstName,
              last_name: payerName?.surname || lastName,
              address_1: billingSource.address_line_1 || "",
              address_2: billingSource.address_line_2 || "",
              city: billingSource.admin_area_2 || "",
              province: billingSource.admin_area_1 || "",
              postal_code: billingSource.postal_code || "",
              country_code:
                billingSource.country_code?.toLowerCase() || "",
              phone:
                (payer as any)?.phone?.phone_number?.national_number || "",
            }
          : mappedAddress

        await updateCartAddresses({
          shipping_address: mappedAddress,
          billing_address: billingAddress,
          email: payer?.email_address || undefined,
        })
      }

      await onPaymentCompleted()
    } catch (err: any) {
      setErrorMessage(
        err?.message || "An unknown error occurred, please try again."
      )
      setSubmitting(false)
    }
  }

  const [{ isPending, isResolved }] = usePayPalScriptReducer()

  if (isPending) {
    return <Spinner />
  }

  if (isResolved) {
    return (
      <>
        <PayPalButtons
          style={{ layout: "horizontal" }}
          createOrder={async () =>
            (session?.data?.paypalOrderId as string) ||
            (session?.data?.id as string)
          }
          onApprove={handlePayment}
          disabled={notReady || submitting || isPending}
          data-testid={dataTestId}
        />
        <ErrorMessage
          error={errorMessage}
          data-testid="paypal-payment-error-message"
        />
      </>
    )
  }
}

const ManualTestPaymentButton = ({ notReady }: { notReady: boolean }) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = () => {
    setSubmitting(true)

    onPaymentCompleted()
  }

  return (
    <>
      <Button
        disabled={notReady}
        isLoading={submitting}
        onClick={handlePayment}
        size="large"
        data-testid="submit-order-button"
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="manual-payment-error-message"
      />
    </>
  )
}

const MolliePaymentButton = ({
  cart,
  notReady,
  "data-testid": dataTestId,
}: {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}) => {
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Always call hook (React rules). Returns default if no MollieWrapper parent.
  const { mollieInstance } = useMollie()

  const session = cart.payment_collection?.payment_sessions?.find(
    (s) => s.status === "pending"
  )

  const onPaymentCompleted = async () => {
    await placeOrder()
      .catch((err) => {
        setErrorMessage(err.message)
      })
      .finally(() => {
        setSubmitting(false)
      })
  }

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    try {
      const sessionData = session?.data as any
      const isCreditCard = sessionData?.method === "creditcard"

      if (isCreditCard && mollieInstance) {
        // Tokenize credit card via Mollie Components
        const tokenResult = await mollieInstance.createToken()
        if (tokenResult.error) {
          setErrorMessage(tokenResult.error.message || "Card verification failed")
          setSubmitting(false)
          return
        }
        // Token is stored internally by Mollie and used during payment creation
      }

      // Check for redirect URL in session data (iDEAL, Bancontact, Klarna, etc.)
      const checkoutUrl = sessionData?.checkoutUrl || sessionData?.approvalUrl
      if (checkoutUrl) {
        window.location.href = checkoutUrl
        return
      }

      // For credit card without redirect (no 3DS) or already authorized
      await onPaymentCompleted()
    } catch (err: any) {
      setErrorMessage(err.message || "Payment failed")
      setSubmitting(false)
    }
  }

  return (
    <>
      <Button
        disabled={notReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        Place order
      </Button>
      <ErrorMessage
        error={errorMessage}
        data-testid="mollie-payment-error-message"
      />
    </>
  )
}

export default PaymentButton
