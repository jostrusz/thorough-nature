import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates, resolveTemplateKey } from '../modules/email-notifications/templates'
import { resolveBillingEntity } from '../utils/resolve-billing-entity'
import { logEmailActivity } from '../utils/email-logger'
import { getProjectEmailConfig } from '../utils/project-email-config'

/**
 * Customer Notification: Upsell / Order Edit Confirmed
 *
 * Sends a notification email to the CUSTOMER when an order edit is confirmed
 * (i.e., an upsell product was added). Only fires for projects that have an
 * upsell-confirmed template (currently psi-superzivot with ps- prefix).
 */
export default async function orderEditCustomerNotificationHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const logger = container.resolve('logger') as any

  try {
    const orderId = data.order_id
    if (!orderId) return

    const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
    const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)

    const order = await orderModuleService.retrieveOrder(orderId, {
      relations: ['items', 'summary', 'shipping_address'],
    })

    // Check if this project has an upsell-confirmed template
    const projectConfig = getProjectEmailConfig(order)
    const templateKey = resolveTemplateKey('upsell-confirmed', projectConfig.project)

    // If resolveTemplateKey returns the same key (no project prefix found), skip
    if (templateKey === 'upsell-confirmed') {
      logger.info(`[CustomerNotif:Upsell] No upsell-confirmed template for project "${projectConfig.project}", skipping customer email`)
      return
    }

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

    // Try to identify newly added items
    let addedItems: any[] = []
    if (data.actions && Array.isArray(data.actions)) {
      const addActions = data.actions.filter(
        (a: any) => a.action === 'ITEM_ADD' || a.action === 'ADD_ITEM'
      )
      if (addActions.length > 0) {
        const allItems = order.items || []
        for (const action of addActions) {
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

    // Resolve billing entity for footer
    let billingEntity: any = null
    try {
      billingEntity = await resolveBillingEntity(container, orderId)
    } catch (err: any) {
      logger.warn(`[CustomerNotif:Upsell] Could not resolve billing entity: ${err.message}`)
    }

    const displayId = (order as any).metadata?.custom_order_number || (order as any).display_id || order.id
    const emailSubject = `Objednávka ${displayId} — aktualizována`

    await notificationModuleService.createNotifications({
      to: order.email,
      channel: 'email',
      template: templateKey,
      ...(projectConfig.fromEmail ? { from: projectConfig.fromEmail } : {}),
      data: {
        emailOptions: {
          replyTo: projectConfig.replyTo,
          subject: emailSubject,
        },
        order,
        shippingAddress,
        addedItems: addedItems.length > 0 ? addedItems : undefined,
        billingEntity,
        preview: 'Vaše objednávka byla aktualizována!',
      },
    })

    await logEmailActivity(orderModuleService, orderId, {
      template: "upsell_confirmed_customer",
      subject: emailSubject,
      to: order.email,
      status: "sent",
    }).catch((err) => logger.warn(`[CustomerNotif:Upsell] Could not log email activity: ${err.message}`))

    logger.info(`[CustomerNotif:Upsell] Sent upsell customer email for ${displayId} to ${order.email}`)
  } catch (error: any) {
    logger.error(`[CustomerNotif:Upsell] Failed: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: 'order-edit.confirmed',
}
