import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { resolveBillingEntity } from './utils/resolve-billing-entity'

export default async function orderFulfillmentCreatedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  // Respect no_notification flag
  if (data.no_notification) {
    console.log('[ShipmentNotification] Skipped — no_notification is true')
    return
  }

  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  try {
    const orderId = data.order_id
    const fulfillmentId = data.fulfillment_id

    const order = await orderModuleService.retrieveOrder(orderId, {
      relations: ['items', 'shipping_address'],
    })

    // Retrieve full shipping address
    let shippingAddress: any = null
    try {
      if (order.shipping_address) {
        shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(
          order.shipping_address.id
        )
      }
    } catch {
      shippingAddress = order.shipping_address
    }

    // Get fulfillment details (tracking info) via query.graph
    let trackingNumber: string | undefined
    let trackingUrl: string | undefined
    let trackingCompany: string | undefined

    try {
      const { data: fulfillments } = await query.graph({
        entity: 'fulfillment',
        fields: [
          'id',
          'tracking_links.tracking_number',
          'tracking_links.url',
          'labels.tracking_number',
          'labels.tracking_url',
          'provider_id',
          'data',
        ],
        filters: { id: fulfillmentId },
      })

      const fulfillment = fulfillments?.[0]
      if (fulfillment) {
        // Try tracking_links first
        const trackingLink = fulfillment.tracking_links?.[0]
        if (trackingLink) {
          trackingNumber = trackingLink.tracking_number
          trackingUrl = trackingLink.url
        }

        // Fallback to labels
        if (!trackingNumber) {
          const label = fulfillment.labels?.[0]
          if (label) {
            trackingNumber = label.tracking_number
            trackingUrl = label.tracking_url
          }
        }

        // Try to extract carrier from provider_id or data
        const providerId = fulfillment.provider_id || ''
        const fulfillmentData = fulfillment.data || {}
        trackingCompany = fulfillmentData.carrier || fulfillmentData.tracking_company || ''

        // Infer carrier name from provider_id if not set
        if (!trackingCompany) {
          const providerName = providerId.replace(/^fp_/, '').split('_')[0]
          if (providerName === 'manual') {
            trackingCompany = ''
          } else if (providerName) {
            trackingCompany = providerName.charAt(0).toUpperCase() + providerName.slice(1)
          }
        }
      }
    } catch (fulfErr: any) {
      console.warn('[ShipmentNotification] Could not get fulfillment details:', fulfErr.message)
    }

    // Resolve billing entity for footer
    let billingEntity: any = null
    try {
      billingEntity = await resolveBillingEntity(container, orderId)
    } catch (err: any) {
      console.warn('[ShipmentNotification] Could not resolve billing entity:', err.message)
    }

    const displayId = (order as any).metadata?.custom_order_number || (order as any).display_id || order.id

    await notificationModuleService.createNotifications({
      to: order.email,
      channel: 'email',
      template: EmailTemplates.SHIPMENT_NOTIFICATION,
      data: {
        emailOptions: {
          replyTo: 'devries@loslatenboek.nl',
          subject: `Je bestelling #${displayId} is verzonden! 📦`,
        },
        order,
        shippingAddress,
        trackingNumber,
        trackingUrl,
        trackingCompany,
        billingEntity,
        preview: 'Je bestelling is verzonden!',
      },
    })

    console.log(`[ShipmentNotification] Sent shipment email for order ${orderId} (fulfillment ${fulfillmentId})`)
  } catch (error: any) {
    console.error('[ShipmentNotification] Error sending shipment notification:', error.message)
  }
}

export const config: SubscriberConfig = {
  event: 'order.fulfillment_created',
}
