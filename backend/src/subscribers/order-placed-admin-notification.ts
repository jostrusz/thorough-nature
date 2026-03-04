import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'

/**
 * Admin Notification: New Order Placed
 *
 * Sends a motivational notification email to the admin when a new order is placed.
 * Randomly selects one of 10 themed variants (Money Printer, Rocket Launch, etc.)
 * Works for ALL projects (Loslatenboek, De Hondenbijbel, etc.)
 */

const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL || 'jaroslavostruszka@gmail.com'
const TOTAL_VARIANTS = 10

/** Wait for other subscribers (custom number, payment metadata) to finish first */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export default async function orderPlacedAdminNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve('logger') as any

  try {
    // Delay 3s to let other subscribers (custom order number, payment metadata)
    // finish writing to order metadata first. This ensures we have the full
    // custom_order_number (e.g. NL2026-84) instead of just display_id (84).
    await sleep(3000)

    const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
    const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)

    const order = await orderModuleService.retrieveOrder(data.id, {
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
        filters: { id: data.id },
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
        else if (mollieMethod === 'creditcard' || mollieMethod === 'credit_card') paymentMethod = 'Credit Card'
        else if (providerId.includes('paypal') || mollieMethod === 'paypal') paymentMethod = 'PayPal'
        else if (providerId.includes('klarna') || mollieMethod.includes('klarna')) paymentMethod = 'Klarna'
        else if (providerId.includes('stripe')) paymentMethod = 'Credit Card'
        else if (mollieMethod) paymentMethod = mollieMethod.charAt(0).toUpperCase() + mollieMethod.slice(1)
      }
    } catch (err: any) {
      logger.warn(`[AdminNotif] Could not detect payment method: ${err.message}`)
    }

    // Pick random variant (0-9)
    const variantIndex = Math.floor(Math.random() * TOTAL_VARIANTS)

    const displayId = (order as any).metadata?.custom_order_number || (order as any).display_id || order.id
    const currency = order.currency_code || 'eur'
    const total = (order as any).summary?.raw_current_order_total?.value
      ?? (order as any).summary?.current_order_total
      ?? 0

    // Format total for subject
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

    const emailSubject = `${emoji} New order! ${displayId} — ${totalFormatted}`

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
        type: 'new_order',
        variantIndex,
      },
    })

    logger.info(`[AdminNotif] Sent new order notification (variant #${variantIndex + 1}) for ${displayId} to ${ADMIN_EMAIL}`)
  } catch (error: any) {
    logger.error(`[AdminNotif] Failed to send admin notification: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
