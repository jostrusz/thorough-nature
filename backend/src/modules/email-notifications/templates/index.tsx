import { ReactNode } from 'react'
import { MedusaError } from '@medusajs/framework/utils'
import { InviteUserEmail, INVITE_USER, isInviteUserData } from './invite-user'
import { OrderPlacedTemplate, ORDER_PLACED, isOrderPlacedTemplateData } from './order-placed'
import { AbandonedCheckoutTemplate, ABANDONED_CHECKOUT, isAbandonedCheckoutData } from './abandoned-checkout'
import { EbookDeliveryTemplate, EBOOK_DELIVERY, isEbookDeliveryData } from './ebook-delivery'
import { ShipmentNotificationTemplate, SHIPMENT_NOTIFICATION, isShipmentNotificationData } from './shipment-notification'
// De Hondenbijbel templates
import { DhOrderPlacedTemplate, DH_ORDER_PLACED, isDhOrderPlacedTemplateData } from './dh-order-placed'
import { DhAbandonedCheckoutTemplate, DH_ABANDONED_CHECKOUT, isDhAbandonedCheckoutData } from './dh-abandoned-checkout'
import { DhEbookDeliveryTemplate, DH_EBOOK_DELIVERY, isDhEbookDeliveryData } from './dh-ebook-delivery'
import { DhShipmentNotificationTemplate, DH_SHIPMENT_NOTIFICATION, isDhShipmentNotificationData } from './dh-shipment-notification'

export const EmailTemplates = {
  INVITE_USER,
  // Loslatenboek (default)
  ORDER_PLACED,
  ABANDONED_CHECKOUT,
  EBOOK_DELIVERY,
  SHIPMENT_NOTIFICATION,
  // De Hondenbijbel
  DH_ORDER_PLACED,
  DH_ABANDONED_CHECKOUT,
  DH_EBOOK_DELIVERY,
  DH_SHIPMENT_NOTIFICATION,
} as const

export type EmailTemplateType = keyof typeof EmailTemplates

/**
 * Map a generic template key to a project-specific key.
 * When `project` is "dehondenbijbel", we prefix with "dh-".
 * Falls back to the original key if no DH variant exists.
 */
export function resolveTemplateKey(templateKey: string, project?: string): string {
  if (project === 'dehondenbijbel') {
    const dhKey = `dh-${templateKey}`
    // Check if we have a DH variant registered
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(dhKey)) {
      return dhKey
    }
  }
  return templateKey
}

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

    // ── Loslatenboek templates ──────────────────────────────────
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

    // ── De Hondenbijbel templates ───────────────────────────────
    case EmailTemplates.DH_ORDER_PLACED:
      if (!isDhOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_ORDER_PLACED}"`
        )
      }
      return <DhOrderPlacedTemplate {...data} />

    case EmailTemplates.DH_ABANDONED_CHECKOUT:
      if (!isDhAbandonedCheckoutData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_ABANDONED_CHECKOUT}"`
        )
      }
      return <DhAbandonedCheckoutTemplate {...data} />

    case EmailTemplates.DH_EBOOK_DELIVERY:
      if (!isDhEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_EBOOK_DELIVERY}"`
        )
      }
      return <DhEbookDeliveryTemplate {...data} />

    case EmailTemplates.DH_SHIPMENT_NOTIFICATION:
      if (!isDhShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <DhShipmentNotificationTemplate {...data} />

    default:
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Unknown template key: "${templateKey}"`
      )
  }
}

export {
  // Loslatenboek
  InviteUserEmail,
  OrderPlacedTemplate,
  AbandonedCheckoutTemplate,
  EbookDeliveryTemplate,
  ShipmentNotificationTemplate,
  // De Hondenbijbel
  DhOrderPlacedTemplate,
  DhAbandonedCheckoutTemplate,
  DhEbookDeliveryTemplate,
  DhShipmentNotificationTemplate,
}
