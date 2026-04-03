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
import { DhAbandonedCheckout1Template, DH_ABANDONED_CHECKOUT_1, isDhAbandonedCheckout1Data } from './dh-abandoned-checkout-1'
import { DhAbandonedCheckout2Template, DH_ABANDONED_CHECKOUT_2, isDhAbandonedCheckout2Data } from './dh-abandoned-checkout-2'
import { DhAbandonedCheckout3Template, DH_ABANDONED_CHECKOUT_3, isDhAbandonedCheckout3Data } from './dh-abandoned-checkout-3'
import { DhEbookDeliveryTemplate, DH_EBOOK_DELIVERY, isDhEbookDeliveryData } from './dh-ebook-delivery'
import { DhShipmentNotificationTemplate, DH_SHIPMENT_NOTIFICATION, isDhShipmentNotificationData } from './dh-shipment-notification'
import { DhUpsellConfirmedTemplate, DH_UPSELL_CONFIRMED, isDhUpsellConfirmedData } from './dh-upsell-confirmed'
// Släpp Taget templates
import { StOrderPlacedTemplate, ST_ORDER_PLACED, isStOrderPlacedTemplateData } from './st-order-placed'
import { StAbandonedCheckout1Template, ST_ABANDONED_CHECKOUT_1, isStAbandonedCheckout1Data } from './st-abandoned-checkout-1'
import { StAbandonedCheckout2Template, ST_ABANDONED_CHECKOUT_2, isStAbandonedCheckout2Data } from './st-abandoned-checkout-2'
import { StAbandonedCheckout3Template, ST_ABANDONED_CHECKOUT_3, isStAbandonedCheckout3Data } from './st-abandoned-checkout-3'
import { StEbookDeliveryTemplate, ST_EBOOK_DELIVERY, isStEbookDeliveryData } from './st-ebook-delivery'
import { StShipmentNotificationTemplate, ST_SHIPMENT_NOTIFICATION, isStShipmentNotificationData } from './st-shipment-notification'
// Odpuść to, co cię niszczy (odpusc-ksiazka) templates
import { OkOrderPlacedTemplate, OK_ORDER_PLACED, isOkOrderPlacedTemplateData } from './ok-order-placed'
import { OkAbandonedCheckout1Template, OK_ABANDONED_CHECKOUT_1, isOkAbandonedCheckout1Data } from './ok-abandoned-checkout-1'
import { OkAbandonedCheckout2Template, OK_ABANDONED_CHECKOUT_2, isOkAbandonedCheckout2Data } from './ok-abandoned-checkout-2'
import { OkAbandonedCheckout3Template, OK_ABANDONED_CHECKOUT_3, isOkAbandonedCheckout3Data } from './ok-abandoned-checkout-3'
import { OkEbookDeliveryTemplate, OK_EBOOK_DELIVERY, isOkEbookDeliveryData } from './ok-ebook-delivery'
import { OkShipmentNotificationTemplate, OK_SHIPMENT_NOTIFICATION, isOkShipmentNotificationData } from './ok-shipment-notification'
// Lass los, was dich kaputt macht (lass-los) templates
import { LlOrderPlacedTemplate, LL_ORDER_PLACED, isLlOrderPlacedTemplateData } from './ll-order-placed'
import { LlEbookDeliveryTemplate, LL_EBOOK_DELIVERY, isLlEbookDeliveryData } from './ll-ebook-delivery'
import { LlShipmentNotificationTemplate, LL_SHIPMENT_NOTIFICATION, isLlShipmentNotificationData } from './ll-shipment-notification'
import { LlAbandonedCheckout1Template, LL_ABANDONED_CHECKOUT_1, isLlAbandonedCheckout1Data } from './ll-abandoned-checkout-1'
import { LlAbandonedCheckout2Template, LL_ABANDONED_CHECKOUT_2, isLlAbandonedCheckout2Data } from './ll-abandoned-checkout-2'
import { LlAbandonedCheckout3Template, LL_ABANDONED_CHECKOUT_3, isLlAbandonedCheckout3Data } from './ll-abandoned-checkout-3'
// Loslatenboek abandoned checkout 3-step sequence
import { LbAbandonedCheckout1Template, LB_ABANDONED_CHECKOUT_1, isLbAbandonedCheckout1Data } from './lb-abandoned-checkout-1'
import { LbAbandonedCheckout2Template, LB_ABANDONED_CHECKOUT_2, isLbAbandonedCheckout2Data } from './lb-abandoned-checkout-2'
import { LbAbandonedCheckout3Template, LB_ABANDONED_CHECKOUT_3, isLbAbandonedCheckout3Data } from './lb-abandoned-checkout-3'
// Psí superživot (psi-superzivot) templates
import { PsOrderPlacedTemplate, PS_ORDER_PLACED, isPsOrderPlacedTemplateData } from './ps-order-placed'
import { PsShipmentNotificationTemplate, PS_SHIPMENT_NOTIFICATION, isPsShipmentNotificationData } from './ps-shipment-notification'
import { PsUpsellConfirmedTemplate, PS_UPSELL_CONFIRMED, isPsUpsellConfirmedData } from './ps-upsell-confirmed'
// Admin notification
import { AdminOrderNotificationTemplate, ADMIN_ORDER_NOTIFICATION, isAdminOrderNotificationData } from './admin-order-notification'

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
  DH_ABANDONED_CHECKOUT_1,
  DH_ABANDONED_CHECKOUT_2,
  DH_ABANDONED_CHECKOUT_3,
  DH_EBOOK_DELIVERY,
  DH_SHIPMENT_NOTIFICATION,
  DH_UPSELL_CONFIRMED,
  // Släpp Taget
  ST_ORDER_PLACED,
  ST_ABANDONED_CHECKOUT_1,
  ST_ABANDONED_CHECKOUT_2,
  ST_ABANDONED_CHECKOUT_3,
  ST_EBOOK_DELIVERY,
  ST_SHIPMENT_NOTIFICATION,
  // Odpuść to, co cię niszczy
  OK_ORDER_PLACED,
  OK_ABANDONED_CHECKOUT_1,
  OK_ABANDONED_CHECKOUT_2,
  OK_ABANDONED_CHECKOUT_3,
  OK_EBOOK_DELIVERY,
  OK_SHIPMENT_NOTIFICATION,
  // Lass los
  LL_ORDER_PLACED,
  LL_EBOOK_DELIVERY,
  LL_SHIPMENT_NOTIFICATION,
  LL_ABANDONED_CHECKOUT_1,
  LL_ABANDONED_CHECKOUT_2,
  LL_ABANDONED_CHECKOUT_3,
  // Loslatenboek 3-step abandoned checkout
  LB_ABANDONED_CHECKOUT_1,
  LB_ABANDONED_CHECKOUT_2,
  LB_ABANDONED_CHECKOUT_3,
  // Psí superživot
  PS_ORDER_PLACED,
  PS_SHIPMENT_NOTIFICATION,
  PS_UPSELL_CONFIRMED,
  // Admin notifications
  ADMIN_ORDER_NOTIFICATION,
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
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(dhKey)) {
      return dhKey
    }
  }
  if (project === 'slapp-taget') {
    const stKey = `st-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(stKey)) {
      return stKey
    }
  }
  if (project === 'odpusc-ksiazka') {
    const okKey = `ok-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(okKey)) {
      return okKey
    }
  }
  if (project === 'psi-superzivot') {
    const psKey = `ps-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(psKey)) {
      return psKey
    }
  }
  if (project === 'lass-los') {
    const llKey = `ll-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(llKey)) {
      return llKey
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

    case EmailTemplates.DH_ABANDONED_CHECKOUT_1:
      if (!isDhAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <DhAbandonedCheckout1Template {...data} />

    case EmailTemplates.DH_ABANDONED_CHECKOUT_2:
      if (!isDhAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <DhAbandonedCheckout2Template {...data} />

    case EmailTemplates.DH_ABANDONED_CHECKOUT_3:
      if (!isDhAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <DhAbandonedCheckout3Template {...data} />

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

    case EmailTemplates.DH_UPSELL_CONFIRMED:
      if (!isDhUpsellConfirmedData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_UPSELL_CONFIRMED}"`
        )
      }
      return <DhUpsellConfirmedTemplate {...data} />

    // ── Släpp Taget templates ─────────────────────────────────
    case EmailTemplates.ST_ABANDONED_CHECKOUT_1:
      if (!isStAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ST_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <StAbandonedCheckout1Template {...data} />

    case EmailTemplates.ST_ABANDONED_CHECKOUT_2:
      if (!isStAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ST_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <StAbandonedCheckout2Template {...data} />

    case EmailTemplates.ST_ABANDONED_CHECKOUT_3:
      if (!isStAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ST_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <StAbandonedCheckout3Template {...data} />

    case EmailTemplates.ST_ORDER_PLACED:
      if (!isStOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ST_ORDER_PLACED}"`
        )
      }
      return <StOrderPlacedTemplate {...data} />

    case EmailTemplates.ST_EBOOK_DELIVERY:
      if (!isStEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ST_EBOOK_DELIVERY}"`
        )
      }
      return <StEbookDeliveryTemplate {...data} />

    case EmailTemplates.ST_SHIPMENT_NOTIFICATION:
      if (!isStShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ST_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <StShipmentNotificationTemplate {...data} />

    // ── Odpuść to, co cię niszczy templates ────────────────────
    case EmailTemplates.OK_ORDER_PLACED:
      if (!isOkOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OK_ORDER_PLACED}"`
        )
      }
      return <OkOrderPlacedTemplate {...data} />

    case EmailTemplates.OK_EBOOK_DELIVERY:
      if (!isOkEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OK_EBOOK_DELIVERY}"`
        )
      }
      return <OkEbookDeliveryTemplate {...data} />

    case EmailTemplates.OK_SHIPMENT_NOTIFICATION:
      if (!isOkShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OK_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <OkShipmentNotificationTemplate {...data} />

    case EmailTemplates.OK_ABANDONED_CHECKOUT_1:
      if (!isOkAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OK_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <OkAbandonedCheckout1Template {...data} />

    case EmailTemplates.OK_ABANDONED_CHECKOUT_2:
      if (!isOkAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OK_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <OkAbandonedCheckout2Template {...data} />

    case EmailTemplates.OK_ABANDONED_CHECKOUT_3:
      if (!isOkAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OK_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <OkAbandonedCheckout3Template {...data} />

    // ── Lass los templates ──────────────────────────────────
    case EmailTemplates.LL_ORDER_PLACED:
      if (!isLlOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LL_ORDER_PLACED}"`
        )
      }
      return <LlOrderPlacedTemplate {...data} />

    case EmailTemplates.LL_EBOOK_DELIVERY:
      if (!isLlEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LL_EBOOK_DELIVERY}"`
        )
      }
      return <LlEbookDeliveryTemplate {...data} />

    case EmailTemplates.LL_SHIPMENT_NOTIFICATION:
      if (!isLlShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LL_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <LlShipmentNotificationTemplate {...data} />

    case EmailTemplates.LL_ABANDONED_CHECKOUT_1:
      if (!isLlAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LL_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <LlAbandonedCheckout1Template {...data} />

    case EmailTemplates.LL_ABANDONED_CHECKOUT_2:
      if (!isLlAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LL_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <LlAbandonedCheckout2Template {...data} />

    case EmailTemplates.LL_ABANDONED_CHECKOUT_3:
      if (!isLlAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LL_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <LlAbandonedCheckout3Template {...data} />

    // ── Loslatenboek 3-step abandoned checkout ──────────────
    case EmailTemplates.LB_ABANDONED_CHECKOUT_1:
      if (!isLbAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LB_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <LbAbandonedCheckout1Template {...data} />

    case EmailTemplates.LB_ABANDONED_CHECKOUT_2:
      if (!isLbAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LB_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <LbAbandonedCheckout2Template {...data} />

    case EmailTemplates.LB_ABANDONED_CHECKOUT_3:
      if (!isLbAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LB_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <LbAbandonedCheckout3Template {...data} />

    // ── Psí superživot templates ─────────────────────────────
    case EmailTemplates.PS_ORDER_PLACED:
      if (!isPsOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.PS_ORDER_PLACED}"`
        )
      }
      return <PsOrderPlacedTemplate {...data} />

    case EmailTemplates.PS_SHIPMENT_NOTIFICATION:
      if (!isPsShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.PS_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <PsShipmentNotificationTemplate {...data} />

    case EmailTemplates.PS_UPSELL_CONFIRMED:
      if (!isPsUpsellConfirmedData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.PS_UPSELL_CONFIRMED}"`
        )
      }
      return <PsUpsellConfirmedTemplate {...data} />

    // ── Admin notification ───────────────────────────────────
    case EmailTemplates.ADMIN_ORDER_NOTIFICATION:
      if (!isAdminOrderNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ADMIN_ORDER_NOTIFICATION}"`
        )
      }
      return <AdminOrderNotificationTemplate {...data} />

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
  DhAbandonedCheckout1Template,
  DhAbandonedCheckout2Template,
  DhAbandonedCheckout3Template,
  DhEbookDeliveryTemplate,
  DhShipmentNotificationTemplate,
  DhUpsellConfirmedTemplate,
  // Släpp Taget
  StOrderPlacedTemplate,
  StAbandonedCheckout1Template,
  StAbandonedCheckout2Template,
  StAbandonedCheckout3Template,
  StEbookDeliveryTemplate,
  StShipmentNotificationTemplate,
  // Odpuść to, co cię niszczy
  OkOrderPlacedTemplate,
  OkAbandonedCheckout1Template,
  OkAbandonedCheckout2Template,
  OkAbandonedCheckout3Template,
  OkEbookDeliveryTemplate,
  OkShipmentNotificationTemplate,
  // Lass los
  LlOrderPlacedTemplate,
  LlEbookDeliveryTemplate,
  LlShipmentNotificationTemplate,
  LlAbandonedCheckout1Template,
  LlAbandonedCheckout2Template,
  LlAbandonedCheckout3Template,
  // Psí superživot
  PsOrderPlacedTemplate,
  PsShipmentNotificationTemplate,
  PsUpsellConfirmedTemplate,
  // Admin notification
  AdminOrderNotificationTemplate,
}
