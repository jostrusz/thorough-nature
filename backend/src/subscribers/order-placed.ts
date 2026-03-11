import { ContainerRegistrationKeys, Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates, resolveTemplateKey } from '../modules/email-notifications/templates'
import { resolveBillingEntity } from '../utils/resolve-billing-entity'
import { logEmailActivity } from '../utils/email-logger'
import { renderEmailToHtml } from '../utils/render-email-html'
import { getProjectEmailConfig, getEmailSubject } from '../utils/project-email-config'

export default async function orderPlacedHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)

  const order = await orderModuleService.retrieveOrder(data.id, {
    relations: ['items', 'summary', 'shipping_address', 'billing_address'],
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

  // Retrieve full billing address
  let billingAddress: any = null
  try {
    if ((order as any).billing_address) {
      billingAddress = await (orderModuleService as any).orderAddressService_.retrieve(
        (order as any).billing_address.id
      )
    }
  } catch {
    // Will fall back to shipping address in template
  }

  // Detect payment method from payment collections
  let paymentMethod = 'Online betaling'
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
    const payments =
      paymentData?.[0]?.payment_collections?.flatMap(
        (pc: any) => pc.payments || []
      ) || []
    const firstPayment = payments[0]
    if (firstPayment) {
      const providerId = (firstPayment.provider_id || '').toLowerCase()
      const payData = firstPayment.data || {}
      const mollieMethod = (payData.mollieMethod || payData.method || '').toLowerCase()

      if (mollieMethod === 'ideal' || payData.molliePaymentId?.includes('ideal')) {
        paymentMethod = 'iDEAL'
      } else if (mollieMethod === 'bancontact') {
        paymentMethod = 'Bancontact'
      } else if (mollieMethod === 'creditcard' || mollieMethod === 'credit_card') {
        paymentMethod = 'Credit Card'
      } else if (mollieMethod === 'sofort' || mollieMethod === 'sofortbanking') {
        paymentMethod = 'SOFORT'
      } else if (mollieMethod === 'eps') {
        paymentMethod = 'EPS'
      } else if (mollieMethod === 'giropay') {
        paymentMethod = 'Giropay'
      } else if (providerId.includes('klarna') || mollieMethod.includes('klarna')) {
        paymentMethod = 'Klarna'
      } else if (providerId.includes('stripe')) {
        paymentMethod = 'Credit Card'
      } else if (providerId.includes('paypal') || mollieMethod === 'paypal') {
        paymentMethod = 'PayPal'
      } else if (providerId.includes('comgate')) {
        paymentMethod = 'Comgate'
      } else if (providerId.includes('przelewy') || mollieMethod.includes('przelewy')) {
        paymentMethod = 'Przelewy24'
      } else if (mollieMethod) {
        paymentMethod = mollieMethod.charAt(0).toUpperCase() + mollieMethod.slice(1)
      }
    }
  } catch (payErr: any) {
    console.warn('[OrderPlaced] Could not detect payment method:', payErr.message)
  }

  const displayId = (order as any).metadata?.custom_order_number || (order as any).display_id || order.id

  // Resolve billing entity for footer
  let billingEntity: any = null
  try {
    billingEntity = await resolveBillingEntity(container, data.id)
  } catch (err: any) {
    console.warn('[OrderPlaced] Could not resolve billing entity:', err.message)
  }

  // Project-specific email config (DH vs Loslatenboek)
  const projectConfig = getProjectEmailConfig(order)
  const templateKey = resolveTemplateKey(EmailTemplates.ORDER_PLACED, projectConfig.project)

  const emailSubject = `${getEmailSubject(projectConfig, 'orderPlaced')} ${displayId}`
  const emailPreview = getEmailSubject(projectConfig, 'orderPlacedPreview')
  try {
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
        billingAddress,
        paymentMethod,
        billingEntity,
        preview: emailPreview,
      },
    })

    // Render HTML for email preview in timeline
    const emailData = {
      emailOptions: {
        replyTo: projectConfig.replyTo,
        subject: emailSubject,
      },
      order,
      shippingAddress,
      billingAddress,
      paymentMethod,
      billingEntity,
      preview: emailPreview,
    }
    const htmlBody = await renderEmailToHtml(templateKey, emailData).catch(() => '')

    await logEmailActivity(orderModuleService, data.id, {
      template: "order_confirmation",
      subject: emailSubject,
      to: order.email,
      status: "sent",
      ...(htmlBody ? { html_body: htmlBody } : {}),
    }).catch((err) => console.warn('[OrderPlaced] Could not log email activity:', err.message))
  } catch (error: any) {
    console.error('Error sending order confirmation notification:', error)
    await logEmailActivity(orderModuleService, data.id, {
      template: "order_confirmation",
      subject: emailSubject,
      to: order.email,
      status: "failed",
      error_message: error.message,
    }).catch(() => {})
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
