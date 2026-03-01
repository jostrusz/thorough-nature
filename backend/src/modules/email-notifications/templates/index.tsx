import { ReactNode } from 'react'
import { MedusaError } from '@medusajs/framework/utils'
import { InviteUserEmail, INVITE_USER, isInviteUserData } from './invite-user'
import { OrderPlacedTemplate, ORDER_PLACED, isOrderPlacedTemplateData } from './order-placed'
import { AbandonedCheckoutTemplate, ABANDONED_CHECKOUT, isAbandonedCheckoutData } from './abandoned-checkout'
import { EbookDeliveryTemplate, EBOOK_DELIVERY, isEbookDeliveryData } from './ebook-delivery'
import { ShipmentNotificationTemplate, SHIPMENT_NOTIFICATION, isShipmentNotificationData } from './shipment-notification'

export const EmailTemplates = {
  INVITE_USER,
  ORDER_PLACED,
  ABANDONED_CHECKOUT,
  EBOOK_DELIVERY,
  SHIPMENT_NOTIFICATION,
} as const

export type EmailTemplateType = keyof typeof EmailTemplates

export function generateEmailTemplate(templateKey: string, data: unknown): ReactNode {
  switch (templateKey) {
    case EmailTemplates.INVITE_USER:
      if (!isInviteUserData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.INVITE_USER}"`
        )
      }
      return <InviteUserEmail {...data} />

    case EmailTemplates.ORDER_PLACED:
      if (!isOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ORDER_PLACED}"`
        )
      }
      return <OrderPlacedTemplate {...data} />

    case EmailTemplates.ABANDONED_CHECKOUT:
      if (!isAbandonedCheckoutData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ABANDONED_CHECKOUT}"`
        )
      }
      return <AbandonedCheckoutTemplate {...data} />

    case EmailTemplates.EBOOK_DELIVERY:
      if (!isEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.EBOOK_DELIVERY}"`
        )
      }
      return <EbookDeliveryTemplate {...data} />

    case EmailTemplates.SHIPMENT_NOTIFICATION:
      if (!isShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.SHIPMENT_NOTIFICATION}"`
        )
      }
      return <ShipmentNotificationTemplate {...data} />

    default:
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown template key: "${templateKey}"`
      )
  }
}

export { InviteUserEmail, OrderPlacedTemplate, AbandonedCheckoutTemplate, EbookDeliveryTemplate, ShipmentNotificationTemplate }
