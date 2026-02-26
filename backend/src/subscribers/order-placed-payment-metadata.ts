// @ts-nocheck
import { Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'

/**
 * Subscriber: Copy Mollie payment ID from payment session data → order metadata
 *
 * When an order is placed, the payment session data contains molliePaymentId or
 * mollieOrderId (set by initiatePayment). This subscriber copies it into order
 * metadata so the Mollie webhook can find the order later.
 *
 * Without this, the webhook can't find the order because it searches by metadata
 * but the metadata isn't set during checkout — only the payment session data is.
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

    // Find Mollie payment ID in payment session data
    const payments = order.payment_collections?.flatMap(
      (pc: any) => pc.payments || []
    ) || []

    let molliePaymentId: string | null = null
    let mollieOrderId: string | null = null
    let paymentMethod: string | null = null

    for (const payment of payments) {
      const paymentData = payment.data || {}
      if (paymentData.molliePaymentId) {
        molliePaymentId = paymentData.molliePaymentId
        paymentMethod = paymentData.method || null
        break
      }
      if (paymentData.mollieOrderId) {
        mollieOrderId = paymentData.mollieOrderId
        paymentMethod = paymentData.method || null
        break
      }
    }

    // Only update if we found a Mollie ID
    if (!molliePaymentId && !mollieOrderId) return

    const existingMetadata = order.metadata || {}
    const newMetadata: any = {
      ...existingMetadata,
    }

    if (molliePaymentId) {
      newMetadata.molliePaymentId = molliePaymentId
    }
    if (mollieOrderId) {
      newMetadata.mollieOrderId = mollieOrderId
    }
    if (paymentMethod) {
      newMetadata.payment_method = paymentMethod
    }

    await orderModuleService.updateOrders(data.id, {
      metadata: newMetadata,
    })

    console.log(
      `[Payment Metadata] Order ${data.id}: stored ${molliePaymentId ? 'molliePaymentId=' + molliePaymentId : 'mollieOrderId=' + mollieOrderId} in metadata`
    )
  } catch (error: any) {
    // Don't throw — this is non-critical
    console.error(`[Payment Metadata] Failed to copy payment ID to order metadata: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
