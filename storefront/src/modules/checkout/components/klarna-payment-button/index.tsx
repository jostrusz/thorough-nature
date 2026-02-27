'use client'

import React, { useEffect, useState } from 'react'
import { Button } from "@medusajs/ui"
import { HttpTypes } from "@medusajs/types"
import { useKlarna } from '../klarna-wrapper'
import { placeOrder } from "@lib/data/cart"
import ErrorMessage from "../error-message"

const MEDUSA_BACKEND_URL =
  process.env.NEXT_PUBLIC_MEDUSA_BACKEND_URL || "http://localhost:9000"

interface KlarnaPaymentButtonProps {
  cart: HttpTypes.StoreCart
  notReady: boolean
  "data-testid"?: string
}

export function KlarnaPaymentButton({
  cart,
  notReady,
  "data-testid": dataTestId,
}: KlarnaPaymentButtonProps) {
  const { isReady, isLoaded, error, loadWidget, authorize, finalize } = useKlarna()
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [widgetShown, setWidgetShown] = useState(false)

  // Automatically load widget once SDK is ready
  useEffect(() => {
    if (isReady && !isLoaded) {
      loadWidget('#klarna-payments-container', 'pay_later').then((shown) => {
        setWidgetShown(shown)
        if (!shown) {
          // Try pay_over_time (installments) as fallback
          loadWidget('#klarna-payments-container', 'pay_over_time').then((shown2) => {
            setWidgetShown(shown2)
            if (!shown2) {
              // Try pay_now as last fallback
              loadWidget('#klarna-payments-container').then(setWidgetShown)
            }
          })
        }
      })
    }
  }, [isReady, isLoaded, loadWidget])

  const handlePayment = async () => {
    setSubmitting(true)
    setErrorMessage(null)

    try {
      // 1. Build billing/shipping from cart
      const billingAddress = {
        given_name: cart.billing_address?.first_name || '',
        family_name: cart.billing_address?.last_name || '',
        email: cart.email || '',
        street_address: cart.billing_address?.address_1 || '',
        postal_code: cart.billing_address?.postal_code || '',
        city: cart.billing_address?.city || '',
        country: cart.billing_address?.country_code?.toUpperCase() || '',
        phone: cart.billing_address?.phone || '',
      }

      const shippingAddress = cart.shipping_address ? {
        given_name: cart.shipping_address.first_name || '',
        family_name: cart.shipping_address.last_name || '',
        email: cart.email || '',
        street_address: cart.shipping_address.address_1 || '',
        postal_code: cart.shipping_address.postal_code || '',
        city: cart.shipping_address.city || '',
        country: cart.shipping_address.country_code?.toUpperCase() || '',
        phone: cart.shipping_address.phone || '',
      } : billingAddress

      // 2. Call Klarna authorize — opens Klarna popup
      const result = await authorize(billingAddress, shippingAddress)

      if (result.finalize_required) {
        // Some methods (bank transfer) require finalize
        const finalResult = await finalize()
        if (!finalResult.approved || !finalResult.authorization_token) {
          setErrorMessage('Klarna payment was not approved. Please try another payment method.')
          setSubmitting(false)
          return
        }
        await completeOrder(finalResult.authorization_token)
        return
      }

      if (result.approved && result.authorization_token) {
        // 3. Send authorization_token to backend
        await completeOrder(result.authorization_token)
      } else {
        setErrorMessage('Klarna payment was not approved. Please try another payment method.')
        setSubmitting(false)
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An error occurred during payment')
      setSubmitting(false)
    }
  }

  const completeOrder = async (authorizationToken: string) => {
    try {
      // Step 1: Save authorization_token to payment session data via custom endpoint
      const response = await fetch(`${MEDUSA_BACKEND_URL}/store/klarna/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cart_id: cart.id,
          authorization_token: authorizationToken,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Failed to save Klarna authorization')
      }

      // Step 2: Complete the order — triggers Medusa's authorizePayment on Klarna provider
      await placeOrder()
    } catch (err: any) {
      setErrorMessage(err.message || 'Order creation failed')
      setSubmitting(false)
    }
  }

  return (
    <div>
      {/* Klarna widget container — SDK renders iframe here */}
      <div
        id="klarna-payments-container"
        style={{
          minHeight: widgetShown ? '100px' : '0',
          marginBottom: widgetShown ? '16px' : '0',
          transition: 'all 0.3s ease',
        }}
      />

      {error && (
        <ErrorMessage
          error={error}
          data-testid="klarna-sdk-error-message"
        />
      )}

      <Button
        disabled={notReady || submitting || !isReady}
        onClick={handlePayment}
        size="large"
        isLoading={submitting}
        data-testid={dataTestId}
      >
        Pay with Klarna
      </Button>

      {errorMessage && (
        <ErrorMessage
          error={errorMessage}
          data-testid="klarna-payment-error-message"
        />
      )}
    </div>
  )
}

export default KlarnaPaymentButton
