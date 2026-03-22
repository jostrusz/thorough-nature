import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { sendEbookDelivery } from './order-placed-digital-download'

/**
 * Fallback e-book delivery on order.placed
 *
 * Some payment providers (like Klarna) only authorize at checkout — they don't
 * emit payment.captured until the merchant captures manually. This subscriber
 * waits 15 seconds after order.placed and then sends e-books if they haven't
 * been sent yet by the payment.captured subscriber.
 *
 * The ebook_sent flag in order metadata prevents duplicate sends.
 */
export default async function orderPlacedEbookFallbackHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  // Wait 15 seconds — give payment.captured subscriber a chance to run first
  await new Promise(resolve => setTimeout(resolve, 15000))

  await sendEbookDelivery(data.id, container, 'order.placed-fallback')
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
