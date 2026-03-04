import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'

/**
 * Admin Notification: Upsell / Order Edit Confirmed
 *
 * Sends a motivational notification email to the admin when an order edit is confirmed
 * (i.e., an upsell/order bump product was added to an existing order).
 * Randomly selects one of 10 themed variants.
 */

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'jaroslav@ostruszka.com'
const TOTAL_VARIANTS = 10

export default async function orderEditAdminNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve('logger') as any

  try {
    // The order-edit.confirmed event sends { order_id, actions }
    const orderId = data.order_id
    if (!orderId) {
      logger.warn('[AdminNotif:Upsell] No order_id in event data, skipping')
      return
    }

    const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
    const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)

    const order = await orderModuleService.retrieveOrder(orderId, {
      relations: ['items', 'summary', 'shipping_address'],
    })

    // Get shipping address
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

    // Try to identify newly added items from the order edit actions
    let addedItems: any[] = []
    if (data.actions && Array.isArray(data.actions)) {
      const addActions = data.actions.filter(
        (a: any) => a.action === 'ITEM_ADD' || a.action === 'ADD_ITEM'
      )
      if (addActions.length > 0) {
        // Map action details to a displayable format
        const allItems = order.items || []
        for (const action of addActions) {
          // Find matching item in current order items
          const matchingItem = allItems.find(
            (item: any) =>
              item.variant_id === action.details?.variant_id ||
              item.id === action.details?.reference_id
          )
          if (matchingItem) {
            addedItems.push(matchingItem)
          }
        }
      }
    }

    // If we couldn't identify added items, show all items (still useful)
    if (addedItems.length === 0) {
      addedItems = order.items || []
    }

    // Detect payment method
    let paymentMethod = 'Online'
    try {
      const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: paymentData } = await queryService.graph({
        entity: 'order',
        fields: [
          'payment_collections.payments.provider_id',
          'payment_collections.payments.data',
        ],
        filters: { id: orderId },
      })
      const payments = paymentData?.[0]?.payment_collections?.flatMap(
        (pc: any) => pc.payments || []
      ) || []
      const firstPayment = payments[0]
      if (firstPayment) {
        const providerId = (firstPayment.provider_id || '').toLowerCase()
        const payData = firstPayment.data || {}
        const mollieMethod = (payData.mollieMethod || payData.method || '').toLowerCase()

        if (mollieMethod === 'ideal') paymentMethod = 'iDEAL'
        else if (mollieMethod === 'bancontact') paymentMethod = 'Bancontact'
        else if (providerId.includes('paypal') || mollieMethod === 'paypal') paymentMethod = 'PayPal'
        else if (providerId.includes('klarna') || mollieMethod.includes('klarna')) paymentMethod = 'Klarna'
        else if (providerId.includes('stripe')) paymentMethod = 'Credit Card'
        else if (mollieMethod) paymentMethod = mollieMethod.charAt(0).toUpperCase() + mollieMethod.slice(1)
      }
    } catch (err: any) {
      logger.warn(`[AdminNotif:Upsell] Could not detect payment method: ${err.message}`)
    }

    // Pick random variant (0-9)
    const variantIndex = Math.floor(Math.random() * TOTAL_VARIANTS)

    const displayId = (order as any).metadata?.custom_order_number || (order as any).display_id || order.id
    const currency = order.currency_code || 'eur'
    const total = (order as any).summary?.raw_current_order_total?.value
      ?? (order as any).summary?.current_order_total
      ?? 0

    let totalFormatted: string
    try {
      totalFormatted = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency.toUpperCase(),
      }).format(total)
    } catch {
      totalFormatted = `€${total.toFixed(2)}`
    }

    const variantEmojis = ['💰', '🚀', '🧘', '🏆', '🌍', '🐺', '💎', '👑', '🏧', '😤']
    const emoji = variantEmojis[variantIndex] || '💰'

    const emailSubject = `${emoji} Upsell hit! ${displayId} — ${totalFormatted}`

    await notificationModuleService.createNotifications({
      to: ADMIN_EMAIL,
      channel: 'email',
      template: EmailTemplates.ADMIN_ORDER_NOTIFICATION,
      data: {
        emailOptions: {
          subject: emailSubject,
        },
        order,
        shippingAddress,
        paymentMethod,
        type: 'upsell_added',
        variantIndex,
        addedItems: addedItems.length > 0 ? addedItems : undefined,
      },
    })

    logger.info(`[AdminNotif:Upsell] Sent upsell notification (variant #${variantIndex + 1}) for ${displayId} to ${ADMIN_EMAIL}`)
  } catch (error: any) {
    logger.error(`[AdminNotif:Upsell] Failed to send admin notification: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: 'order-edit.confirmed',
}
