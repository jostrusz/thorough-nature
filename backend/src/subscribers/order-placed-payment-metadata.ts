// @ts-nocheck
import { Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'

/**
 * Subscriber: Copy payment provider IDs from payment session data → order metadata
 *
 * When an order is placed, the payment session data contains provider-specific IDs
 * (molliePaymentId, klarnaOrderId, etc.). This subscriber copies them into order
 * metadata so webhooks can find the order later.
 *
 * Supported providers: Mollie, Klarna, PayPal, Comgate, Przelewy24, Airwallex, Stripe
 */
export default async function orderPlacedPaymentMetadataHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)

    // Fetch order with payment collections and payments
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "metadata",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters: { id: data.id },
    })

    const order = orders?.[0]
    if (!order) return

    const payments = order.payment_collections?.flatMap(
      (pc: any) => pc.payments || []
    ) || []

    const existingMetadata = order.metadata || {}
    const newMetadata: any = { ...existingMetadata }
    let found = false

    for (const payment of payments) {
      const paymentData = payment.data || {}
      const providerId = payment.provider_id || ""

      // Mollie
      if (paymentData.molliePaymentId) {
        newMetadata.molliePaymentId = paymentData.molliePaymentId
        newMetadata.payment_method = paymentData.method || null
        newMetadata.payment_provider = "mollie"
        found = true
        break
      }
      if (paymentData.mollieOrderId) {
        newMetadata.mollieOrderId = paymentData.mollieOrderId
        newMetadata.payment_method = paymentData.method || null
        newMetadata.payment_provider = "mollie"
        found = true
        break
      }

      // Klarna
      if (paymentData.klarnaOrderId) {
        newMetadata.klarnaOrderId = paymentData.klarnaOrderId
        newMetadata.payment_klarna_order_id = paymentData.klarnaOrderId
        if (paymentData.sessionId) {
          newMetadata.payment_klarna_session_id = paymentData.sessionId
        }
        newMetadata.payment_method = "klarna"
        newMetadata.payment_provider = "klarna"
        found = true
        break
      }

      // PayPal
      if (paymentData.paypalOrderId || (providerId.includes("paypal") && paymentData.id)) {
        const paypalOrderId = paymentData.paypalOrderId || paymentData.orderID || paymentData.id
        const paypalAuthId = paymentData.authorizationId
        const paypalCaptureId = paymentData.captureId

        if (paypalOrderId) {
          newMetadata.paypalOrderId = paypalOrderId
          newMetadata.payment_paypal_order_id = paypalOrderId
        }
        if (paypalAuthId) {
          newMetadata.payment_paypal_authorization_id = paypalAuthId
        }
        if (paypalCaptureId) {
          newMetadata.payment_paypal_capture_id = paypalCaptureId
        }
        newMetadata.payment_method = "paypal"
        newMetadata.payment_provider = "paypal"
        found = true
        break
      }

      // Comgate
      if (paymentData.comgateTransId) {
        newMetadata.comgateTransId = paymentData.comgateTransId
        newMetadata.payment_method = paymentData.method || "comgate"
        found = true
        break
      }

      // Przelewy24
      if (paymentData.p24SessionId || paymentData.p24Token) {
        newMetadata.p24SessionId = paymentData.p24SessionId
        newMetadata.p24Token = paymentData.p24Token
        newMetadata.payment_method = paymentData.method || "przelewy24"
        found = true
        break
      }

      // Airwallex
      if (paymentData.airwallexPaymentIntentId || (providerId.includes("airwallex") && paymentData.intentId)) {
        newMetadata.airwallexPaymentIntentId = paymentData.airwallexPaymentIntentId || paymentData.intentId
        newMetadata.payment_method = paymentData.method || "airwallex"
        newMetadata.payment_provider = "airwallex"
        found = true
        break
      }

      // Stripe
      if (paymentData.stripePaymentIntentId || paymentData.stripeCheckoutSessionId || (providerId.includes("stripe") && paymentData.id)) {
        newMetadata.stripePaymentIntentId = paymentData.stripePaymentIntentId || paymentData.id
        if (paymentData.stripeCheckoutSessionId) {
          newMetadata.stripeCheckoutSessionId = paymentData.stripeCheckoutSessionId
        }
        newMetadata.payment_method = paymentData.method || "card"
        newMetadata.payment_provider = "stripe"
        found = true
        break
      }

      // Generic: detect provider from provider_id
      if (providerId.includes("klarna") && paymentData.sessionId) {
        newMetadata.klarnaOrderId = paymentData.klarnaOrderId || null
        newMetadata.payment_klarna_session_id = paymentData.sessionId
        newMetadata.payment_method = "klarna"
        found = true
        break
      }
    }

    if (!found) return

    await orderModuleService.updateOrders(data.id, {
      metadata: newMetadata,
    })

    const provider = newMetadata.payment_method || "unknown"
    const id =
      newMetadata.molliePaymentId ||
      newMetadata.mollieOrderId ||
      newMetadata.klarnaOrderId ||
      newMetadata.paypalOrderId ||
      newMetadata.comgateTransId ||
      newMetadata.p24SessionId ||
      newMetadata.airwallexPaymentIntentId ||
      newMetadata.stripePaymentIntentId ||
      "n/a"

    console.log(
      `[Payment Metadata] Order ${data.id}: stored ${provider} ID=${id} in metadata`
    )
  } catch (error: any) {
    // Don't throw — this is non-critical
    console.error(`[Payment Metadata] Failed to copy payment ID to order metadata: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
