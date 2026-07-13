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
// Slipp taket (slipp-taket) templates
import { SlOrderPlacedTemplate, SL_ORDER_PLACED, isSlOrderPlacedTemplateData } from './sl-order-placed'
import { SlEbookDeliveryTemplate, SL_EBOOK_DELIVERY, isSlEbookDeliveryData } from './sl-ebook-delivery'
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
// Loslatenboek Brite payment lifecycle (pending / recovery)
import { LbPaymentPendingTemplate, LB_PAYMENT_PENDING, isLbPaymentPendingData } from './lb-payment-pending'
import { LbPaymentRecoveryTemplate, LB_PAYMENT_RECOVERY, isLbPaymentRecoveryData } from './lb-payment-recovery'
// De Hondenbijbel Brite payment lifecycle (pending / recovery)
import { DhPaymentPendingTemplate, DH_PAYMENT_PENDING, isDhPaymentPendingData } from './dh-payment-pending'
import { DhPaymentRecoveryTemplate, DH_PAYMENT_RECOVERY, isDhPaymentRecoveryData } from './dh-payment-recovery'
// Släpp Taget Brite payment lifecycle (pending / recovery)
import { StPaymentPendingTemplate, ST_PAYMENT_PENDING, isStPaymentPendingData } from './st-payment-pending'
import { StPaymentRecoveryTemplate, ST_PAYMENT_RECOVERY, isStPaymentRecoveryData } from './st-payment-recovery'
// Lass los Brite payment lifecycle (pending / recovery)
import { LlPaymentPendingTemplate, LL_PAYMENT_PENDING, isLlPaymentPendingData } from './ll-payment-pending'
import { LlPaymentRecoveryTemplate, LL_PAYMENT_RECOVERY, isLlPaymentRecoveryData } from './ll-payment-recovery'
// Psí superživot (psi-superzivot) templates
import { PsOrderPlacedTemplate, PS_ORDER_PLACED, isPsOrderPlacedTemplateData } from './ps-order-placed'
import { PsShipmentNotificationTemplate, PS_SHIPMENT_NOTIFICATION, isPsShipmentNotificationData } from './ps-shipment-notification'
import { PsEbookDeliveryTemplate, PS_EBOOK_DELIVERY, isPsEbookDeliveryData } from './ps-ebook-delivery'
import { PsUpsellConfirmedTemplate, PS_UPSELL_CONFIRMED, isPsUpsellConfirmedData } from './ps-upsell-confirmed'
// Pusť to, co tě ničí (odpust-knizka) templates
import { OdOrderPlacedTemplate, OD_ORDER_PLACED, isOdOrderPlacedTemplateData } from './od-order-placed'
import { OdEbookDeliveryTemplate, OD_EBOOK_DELIVERY, isOdEbookDeliveryData } from './od-ebook-delivery'
import { OdShipmentNotificationTemplate, OD_SHIPMENT_NOTIFICATION, isOdShipmentNotificationData } from './od-shipment-notification'
// Engedd el, ami tönkretesz (engedd-el, HU) templates
import { EngOrderPlacedTemplate, ENG_ORDER_PLACED, isEngOrderPlacedTemplateData } from './eng-order-placed'
import { EngEbookDeliveryTemplate, ENG_EBOOK_DELIVERY, isEngEbookDeliveryData } from './eng-ebook-delivery'
import { EngShipmentNotificationTemplate, ENG_SHIPMENT_NOTIFICATION, isEngShipmentNotificationData } from './eng-shipment-notification'
import { EngAbandonedCheckout1Template, ENG_ABANDONED_CHECKOUT_1, isEngAbandonedCheckout1Data } from './eng-abandoned-checkout-1'
import { EngAbandonedCheckout2Template, ENG_ABANDONED_CHECKOUT_2, isEngAbandonedCheckout2Data } from './eng-abandoned-checkout-2'
import { EngAbandonedCheckout3Template, ENG_ABANDONED_CHECKOUT_3, isEngAbandonedCheckout3Data } from './eng-abandoned-checkout-3'
import { OdAbandonedCheckout1Template, OD_ABANDONED_CHECKOUT_1, isOdAbandonedCheckout1Data } from './od-abandoned-checkout-1'
import { OdAbandonedCheckout2Template, OD_ABANDONED_CHECKOUT_2, isOdAbandonedCheckout2Data } from './od-abandoned-checkout-2'
import { OdAbandonedCheckout3Template, OD_ABANDONED_CHECKOUT_3, isOdAbandonedCheckout3Data } from './od-abandoned-checkout-3'
// Pusti to, čo ťa ničí (pusti-to-sk) templates
import { SkOrderPlacedTemplate, SK_ORDER_PLACED, isSkOrderPlacedTemplateData } from './sk-order-placed'
import { SkEbookDeliveryTemplate, SK_EBOOK_DELIVERY, isSkEbookDeliveryData } from './sk-ebook-delivery'
import { SkShipmentNotificationTemplate, SK_SHIPMENT_NOTIFICATION, isSkShipmentNotificationData } from './sk-shipment-notification'
import { SkAbandonedCheckout1Template, SK_ABANDONED_CHECKOUT_1, isSkAbandonedCheckout1Data } from './sk-abandoned-checkout-1'
import { SkAbandonedCheckout2Template, SK_ABANDONED_CHECKOUT_2, isSkAbandonedCheckout2Data } from './sk-abandoned-checkout-2'
import { SkAbandonedCheckout3Template, SK_ABANDONED_CHECKOUT_3, isSkAbandonedCheckout3Data } from './sk-abandoned-checkout-3'
// Lâche prise sur ce qui te détruit (lache-livre) templates
import { FrOrderPlacedTemplate, FR_ORDER_PLACED, isFrOrderPlacedTemplateData } from './fr-order-placed'
import { FrShipmentNotificationTemplate, FR_SHIPMENT_NOTIFICATION, isFrShipmentNotificationData } from './fr-shipment-notification'
import { FrAbandonedCheckout1Template, FR_ABANDONED_CHECKOUT_1, isFrAbandonedCheckout1Data } from './fr-abandoned-checkout-1'
import { FrAbandonedCheckout2Template, FR_ABANDONED_CHECKOUT_2, isFrAbandonedCheckout2Data } from './fr-abandoned-checkout-2'
import { FrAbandonedCheckout3Template, FR_ABANDONED_CHECKOUT_3, isFrAbandonedCheckout3Data } from './fr-abandoned-checkout-3'
// Życie, jakiego nigdy sobie nie pozwoliłaś (zycie-zaslugy) templates
import { ZzOrderPlacedTemplate, ZZ_ORDER_PLACED, isZzOrderPlacedTemplateData } from './zz-order-placed'
import { ZzShipmentNotificationTemplate, ZZ_SHIPMENT_NOTIFICATION, isZzShipmentNotificationData } from './zz-shipment-notification'
import { ZzAbandonedCheckout1Template, ZZ_ABANDONED_CHECKOUT_1, isZzAbandonedCheckout1Data } from './zz-abandoned-checkout-1'
import { ZzAbandonedCheckout2Template, ZZ_ABANDONED_CHECKOUT_2, isZzAbandonedCheckout2Data } from './zz-abandoned-checkout-2'
import { ZzAbandonedCheckout3Template, ZZ_ABANDONED_CHECKOUT_3, isZzAbandonedCheckout3Data } from './zz-abandoned-checkout-3'
import { ZzEbookDeliveryTemplate, ZZ_EBOOK_DELIVERY, isZzEbookDeliveryData } from './zz-ebook-delivery'
// Život, jaký si zasloužíš (zivot-zaslugy, CZ) templates
import { ZvOrderPlacedTemplate, ZV_ORDER_PLACED, isZvOrderPlacedTemplateData } from './zv-order-placed'
import { ZvShipmentNotificationTemplate, ZV_SHIPMENT_NOTIFICATION, isZvShipmentNotificationData } from './zv-shipment-notification'
import { ZvAbandonedCheckout1Template, ZV_ABANDONED_CHECKOUT_1, isZvAbandonedCheckout1Data } from './zv-abandoned-checkout-1'
import { ZvAbandonedCheckout2Template, ZV_ABANDONED_CHECKOUT_2, isZvAbandonedCheckout2Data } from './zv-abandoned-checkout-2'
import { ZvAbandonedCheckout3Template, ZV_ABANDONED_CHECKOUT_3, isZvAbandonedCheckout3Data } from './zv-abandoned-checkout-3'
import { ZvEbookDeliveryTemplate, ZV_EBOOK_DELIVERY, isZvEbookDeliveryData } from './zv-ebook-delivery'
// Het Leven Dat Je Verdient (het-leven) templates
import { HlOrderPlacedTemplate, HL_ORDER_PLACED, isHlOrderPlacedTemplateData } from './hl-order-placed'
import { HlEbookDeliveryTemplate, HL_EBOOK_DELIVERY, isHlEbookDeliveryData } from './hl-ebook-delivery'
import { HlShipmentNotificationTemplate, HL_SHIPMENT_NOTIFICATION, isHlShipmentNotificationData } from './hl-shipment-notification'
import { HlAbandonedCheckout1Template, HL_ABANDONED_CHECKOUT_1, isHlAbandonedCheckout1Data } from './hl-abandoned-checkout-1'
import { HlAbandonedCheckout2Template, HL_ABANDONED_CHECKOUT_2, isHlAbandonedCheckout2Data } from './hl-abandoned-checkout-2'
import { HlAbandonedCheckout3Template, HL_ABANDONED_CHECKOUT_3, isHlAbandonedCheckout3Data } from './hl-abandoned-checkout-3'
import { HlPaymentPendingTemplate, HL_PAYMENT_PENDING, isHlPaymentPendingData } from './hl-payment-pending'
import { HlPaymentRecoveryTemplate, HL_PAYMENT_RECOVERY, isHlPaymentRecoveryData } from './hl-payment-recovery'
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
  // Slipp taket
  SL_ORDER_PLACED,
  SL_EBOOK_DELIVERY,
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
  LB_PAYMENT_PENDING,
  LB_PAYMENT_RECOVERY,
  DH_PAYMENT_PENDING,
  DH_PAYMENT_RECOVERY,
  ST_PAYMENT_PENDING,
  ST_PAYMENT_RECOVERY,
  LL_PAYMENT_PENDING,
  LL_PAYMENT_RECOVERY,
  // Psí superživot
  PS_ORDER_PLACED,
  PS_SHIPMENT_NOTIFICATION,
  PS_EBOOK_DELIVERY,
  PS_UPSELL_CONFIRMED,
  // Odpusť to, co tě ničí
  OD_ORDER_PLACED,
  OD_EBOOK_DELIVERY,
  OD_SHIPMENT_NOTIFICATION,
  // Engedd el, ami tönkretesz (HU)
  ENG_ORDER_PLACED,
  ENG_EBOOK_DELIVERY,
  ENG_SHIPMENT_NOTIFICATION,
  ENG_ABANDONED_CHECKOUT_1,
  ENG_ABANDONED_CHECKOUT_2,
  ENG_ABANDONED_CHECKOUT_3,
  OD_ABANDONED_CHECKOUT_1,
  OD_ABANDONED_CHECKOUT_2,
  OD_ABANDONED_CHECKOUT_3,
  SK_ORDER_PLACED,
  SK_EBOOK_DELIVERY,
  SK_SHIPMENT_NOTIFICATION,
  SK_ABANDONED_CHECKOUT_1,
  SK_ABANDONED_CHECKOUT_2,
  SK_ABANDONED_CHECKOUT_3,
  // Lâche prise sur ce qui te détruit (FR)
  FR_ORDER_PLACED,
  FR_SHIPMENT_NOTIFICATION,
  FR_ABANDONED_CHECKOUT_1,
  FR_ABANDONED_CHECKOUT_2,
  FR_ABANDONED_CHECKOUT_3,
  // Życie, jakiego nigdy sobie nie pozwoliłaś
  ZZ_ORDER_PLACED,
  ZZ_SHIPMENT_NOTIFICATION,
  ZZ_ABANDONED_CHECKOUT_1,
  ZZ_ABANDONED_CHECKOUT_2,
  ZZ_ABANDONED_CHECKOUT_3,
  ZZ_EBOOK_DELIVERY,
  // Život, jaký si zasloužíš (CZ)
  ZV_ORDER_PLACED,
  ZV_SHIPMENT_NOTIFICATION,
  ZV_ABANDONED_CHECKOUT_1,
  ZV_ABANDONED_CHECKOUT_2,
  ZV_ABANDONED_CHECKOUT_3,
  ZV_EBOOK_DELIVERY,
  // Het Leven Dat Je Verdient
  HL_ORDER_PLACED,
  HL_EBOOK_DELIVERY,
  HL_SHIPMENT_NOTIFICATION,
  HL_ABANDONED_CHECKOUT_1,
  HL_ABANDONED_CHECKOUT_2,
  HL_ABANDONED_CHECKOUT_3,
  HL_PAYMENT_PENDING,
  HL_PAYMENT_RECOVERY,
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
  if (project === 'slipp-taket') {
    const slKey = `sl-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(slKey)) {
      return slKey
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
  // Kočičí bible falls back to Psí superživot templates (same locale `cs`, same flow)
  // until dedicated kb-* templates are created
  if (project === 'kocici-bible') {
    const psKey = `ps-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(psKey)) {
      return psKey
    }
  }
  if (project === 'odpust-knizka') {
    const odKey = `od-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(odKey)) {
      return odKey
    }
  }
  if (project === 'pusti-to-sk' || project === 'pustitosk') {
    const skKey = `sk-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(skKey)) {
      return skKey
    }
  }
  if (project === 'engedd-el' || project === 'engeddel') {
    const engKey = `eng-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(engKey)) {
      return engKey
    }
  }
  if (project === 'lache-livre') {
    const frKey = `fr-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(frKey)) {
      return frKey
    }
  }
  if (project === 'lass-los') {
    const llKey = `ll-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(llKey)) {
      return llKey
    }
  }
  if (project === 'het-leven') {
    const hlKey = `hl-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(hlKey)) {
      return hlKey
    }
  }
  if (project === 'zycie-zaslugy') {
    const zzKey = `zz-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(zzKey)) {
      return zzKey
    }
  }
  if (project === 'zivot-zaslugy' || project === 'zivotzaslugy') {
    const zvKey = `zv-${templateKey}`
    const allKeys = Object.values(EmailTemplates) as string[]
    if (allKeys.includes(zvKey)) {
      return zvKey
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

    // ── Slipp taket templates ──────────────────────────────────
    case EmailTemplates.SL_ORDER_PLACED:
      if (!isSlOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.SL_ORDER_PLACED}"`
        )
      }
      return <SlOrderPlacedTemplate {...data} />

    case EmailTemplates.SL_EBOOK_DELIVERY:
      if (!isSlEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.SL_EBOOK_DELIVERY}"`
        )
      }
      return <SlEbookDeliveryTemplate {...data} />

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

    // ── Życie, jakiego nigdy sobie nie pozwoliłaś templates ────
    case EmailTemplates.ZZ_ORDER_PLACED:
      if (!isZzOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZZ_ORDER_PLACED}"`
        )
      }
      return <ZzOrderPlacedTemplate {...data} />

    case EmailTemplates.ZZ_SHIPMENT_NOTIFICATION:
      if (!isZzShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZZ_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <ZzShipmentNotificationTemplate {...data} />

    case EmailTemplates.ZZ_ABANDONED_CHECKOUT_1:
      if (!isZzAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZZ_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <ZzAbandonedCheckout1Template {...data} />

    case EmailTemplates.ZZ_ABANDONED_CHECKOUT_2:
      if (!isZzAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZZ_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <ZzAbandonedCheckout2Template {...data} />

    case EmailTemplates.ZZ_ABANDONED_CHECKOUT_3:
      if (!isZzAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZZ_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <ZzAbandonedCheckout3Template {...data} />

    case EmailTemplates.ZZ_EBOOK_DELIVERY:
      if (!isZzEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZZ_EBOOK_DELIVERY}"`
        )
      }
      return <ZzEbookDeliveryTemplate {...data} />

    // ── Život, jaký si zasloužíš (zivot-zaslugy, CZ) templates ──
    case EmailTemplates.ZV_ORDER_PLACED:
      if (!isZvOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZV_ORDER_PLACED}"`
        )
      }
      return <ZvOrderPlacedTemplate {...data} />

    case EmailTemplates.ZV_SHIPMENT_NOTIFICATION:
      if (!isZvShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZV_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <ZvShipmentNotificationTemplate {...data} />

    case EmailTemplates.ZV_ABANDONED_CHECKOUT_1:
      if (!isZvAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZV_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <ZvAbandonedCheckout1Template {...data} />

    case EmailTemplates.ZV_ABANDONED_CHECKOUT_2:
      if (!isZvAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZV_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <ZvAbandonedCheckout2Template {...data} />

    case EmailTemplates.ZV_ABANDONED_CHECKOUT_3:
      if (!isZvAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZV_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <ZvAbandonedCheckout3Template {...data} />

    case EmailTemplates.ZV_EBOOK_DELIVERY:
      if (!isZvEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ZV_EBOOK_DELIVERY}"`
        )
      }
      return <ZvEbookDeliveryTemplate {...data} />

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

    case EmailTemplates.LB_PAYMENT_PENDING:
      if (!isLbPaymentPendingData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LB_PAYMENT_PENDING}"`
        )
      }
      return <LbPaymentPendingTemplate {...data} />

    case EmailTemplates.LB_PAYMENT_RECOVERY:
      if (!isLbPaymentRecoveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LB_PAYMENT_RECOVERY}"`
        )
      }
      return <LbPaymentRecoveryTemplate {...data} />

    case EmailTemplates.DH_PAYMENT_PENDING:
      if (!isDhPaymentPendingData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_PAYMENT_PENDING}"`
        )
      }
      return <DhPaymentPendingTemplate {...data} />

    case EmailTemplates.DH_PAYMENT_RECOVERY:
      if (!isDhPaymentRecoveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.DH_PAYMENT_RECOVERY}"`
        )
      }
      return <DhPaymentRecoveryTemplate {...data} />

    case EmailTemplates.ST_PAYMENT_PENDING:
      if (!isStPaymentPendingData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ST_PAYMENT_PENDING}"`
        )
      }
      return <StPaymentPendingTemplate {...data} />

    case EmailTemplates.ST_PAYMENT_RECOVERY:
      if (!isStPaymentRecoveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ST_PAYMENT_RECOVERY}"`
        )
      }
      return <StPaymentRecoveryTemplate {...data} />

    case EmailTemplates.LL_PAYMENT_PENDING:
      if (!isLlPaymentPendingData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LL_PAYMENT_PENDING}"`
        )
      }
      return <LlPaymentPendingTemplate {...data} />

    case EmailTemplates.LL_PAYMENT_RECOVERY:
      if (!isLlPaymentRecoveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.LL_PAYMENT_RECOVERY}"`
        )
      }
      return <LlPaymentRecoveryTemplate {...data} />

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

    case EmailTemplates.PS_EBOOK_DELIVERY:
      if (!isPsEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.PS_EBOOK_DELIVERY}"`
        )
      }
      return <PsEbookDeliveryTemplate {...data} />

    case EmailTemplates.PS_UPSELL_CONFIRMED:
      if (!isPsUpsellConfirmedData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.PS_UPSELL_CONFIRMED}"`
        )
      }
      return <PsUpsellConfirmedTemplate {...data} />

    // ── Odpusť to, co tě ničí templates ──────────────────────
    case EmailTemplates.OD_ORDER_PLACED:
      if (!isOdOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OD_ORDER_PLACED}"`
        )
      }
      return <OdOrderPlacedTemplate {...data} />

    case EmailTemplates.OD_EBOOK_DELIVERY:
      if (!isOdEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OD_EBOOK_DELIVERY}"`
        )
      }
      return <OdEbookDeliveryTemplate {...data} />

    case EmailTemplates.OD_SHIPMENT_NOTIFICATION:
      if (!isOdShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OD_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <OdShipmentNotificationTemplate {...data} />

    // ── Engedd el, ami tönkretesz (HU) templates ─────────────
    case EmailTemplates.ENG_ORDER_PLACED:
      if (!isEngOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ENG_ORDER_PLACED}"`
        )
      }
      return <EngOrderPlacedTemplate {...data} />

    case EmailTemplates.ENG_EBOOK_DELIVERY:
      if (!isEngEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ENG_EBOOK_DELIVERY}"`
        )
      }
      return <EngEbookDeliveryTemplate {...data} />

    case EmailTemplates.ENG_SHIPMENT_NOTIFICATION:
      if (!isEngShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ENG_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <EngShipmentNotificationTemplate {...data} />

    case EmailTemplates.ENG_ABANDONED_CHECKOUT_1:
      if (!isEngAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ENG_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <EngAbandonedCheckout1Template {...data} />

    case EmailTemplates.ENG_ABANDONED_CHECKOUT_2:
      if (!isEngAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ENG_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <EngAbandonedCheckout2Template {...data} />

    case EmailTemplates.ENG_ABANDONED_CHECKOUT_3:
      if (!isEngAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.ENG_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <EngAbandonedCheckout3Template {...data} />

    case EmailTemplates.OD_ABANDONED_CHECKOUT_1:
      if (!isOdAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OD_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <OdAbandonedCheckout1Template {...data} />

    case EmailTemplates.OD_ABANDONED_CHECKOUT_2:
      if (!isOdAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OD_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <OdAbandonedCheckout2Template {...data} />

    case EmailTemplates.OD_ABANDONED_CHECKOUT_3:
      if (!isOdAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.OD_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <OdAbandonedCheckout3Template {...data} />

    // ── Pusti to, čo ťa ničí (SK) templates ──────────────────
    case EmailTemplates.SK_ORDER_PLACED:
      if (!isSkOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.SK_ORDER_PLACED}"`
        )
      }
      return <SkOrderPlacedTemplate {...data} />

    case EmailTemplates.SK_EBOOK_DELIVERY:
      if (!isSkEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.SK_EBOOK_DELIVERY}"`
        )
      }
      return <SkEbookDeliveryTemplate {...data} />

    case EmailTemplates.SK_SHIPMENT_NOTIFICATION:
      if (!isSkShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.SK_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <SkShipmentNotificationTemplate {...data} />

    case EmailTemplates.SK_ABANDONED_CHECKOUT_1:
      if (!isSkAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.SK_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <SkAbandonedCheckout1Template {...data} />

    case EmailTemplates.SK_ABANDONED_CHECKOUT_2:
      if (!isSkAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.SK_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <SkAbandonedCheckout2Template {...data} />

    case EmailTemplates.SK_ABANDONED_CHECKOUT_3:
      if (!isSkAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.SK_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <SkAbandonedCheckout3Template {...data} />

    // ── Lâche prise sur ce qui te détruit (FR) templates ─────
    case EmailTemplates.FR_ORDER_PLACED:
      if (!isFrOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.FR_ORDER_PLACED}"`
        )
      }
      return <FrOrderPlacedTemplate {...data} />

    case EmailTemplates.FR_SHIPMENT_NOTIFICATION:
      if (!isFrShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.FR_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <FrShipmentNotificationTemplate {...data} />

    case EmailTemplates.FR_ABANDONED_CHECKOUT_1:
      if (!isFrAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.FR_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <FrAbandonedCheckout1Template {...data} />

    case EmailTemplates.FR_ABANDONED_CHECKOUT_2:
      if (!isFrAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.FR_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <FrAbandonedCheckout2Template {...data} />

    case EmailTemplates.FR_ABANDONED_CHECKOUT_3:
      if (!isFrAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.FR_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <FrAbandonedCheckout3Template {...data} />

    // ── Het Leven Dat Je Verdient templates ──────────────────
    case EmailTemplates.HL_ORDER_PLACED:
      if (!isHlOrderPlacedTemplateData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.HL_ORDER_PLACED}"`
        )
      }
      return <HlOrderPlacedTemplate {...data} />

    case EmailTemplates.HL_EBOOK_DELIVERY:
      if (!isHlEbookDeliveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.HL_EBOOK_DELIVERY}"`
        )
      }
      return <HlEbookDeliveryTemplate {...data} />

    case EmailTemplates.HL_SHIPMENT_NOTIFICATION:
      if (!isHlShipmentNotificationData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.HL_SHIPMENT_NOTIFICATION}"`
        )
      }
      return <HlShipmentNotificationTemplate {...data} />

    case EmailTemplates.HL_ABANDONED_CHECKOUT_1:
      if (!isHlAbandonedCheckout1Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.HL_ABANDONED_CHECKOUT_1}"`
        )
      }
      return <HlAbandonedCheckout1Template {...data} />

    case EmailTemplates.HL_ABANDONED_CHECKOUT_2:
      if (!isHlAbandonedCheckout2Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.HL_ABANDONED_CHECKOUT_2}"`
        )
      }
      return <HlAbandonedCheckout2Template {...data} />

    case EmailTemplates.HL_ABANDONED_CHECKOUT_3:
      if (!isHlAbandonedCheckout3Data(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.HL_ABANDONED_CHECKOUT_3}"`
        )
      }
      return <HlAbandonedCheckout3Template {...data} />

    case EmailTemplates.HL_PAYMENT_PENDING:
      if (!isHlPaymentPendingData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.HL_PAYMENT_PENDING}"`
        )
      }
      return <HlPaymentPendingTemplate {...data} />

    case EmailTemplates.HL_PAYMENT_RECOVERY:
      if (!isHlPaymentRecoveryData(data)) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Invalid data for template "${EmailTemplates.HL_PAYMENT_RECOVERY}"`
        )
      }
      return <HlPaymentRecoveryTemplate {...data} />

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
  // Slipp taket
  SlOrderPlacedTemplate,
  SlEbookDeliveryTemplate,
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
  PsEbookDeliveryTemplate,
  PsUpsellConfirmedTemplate,
  // Odpusť to, co tě ničí
  OdOrderPlacedTemplate,
  OdEbookDeliveryTemplate,
  OdShipmentNotificationTemplate,
  // Engedd el, ami tönkretesz (HU)
  EngOrderPlacedTemplate,
  EngEbookDeliveryTemplate,
  EngShipmentNotificationTemplate,
  EngAbandonedCheckout1Template,
  EngAbandonedCheckout2Template,
  EngAbandonedCheckout3Template,
  OdAbandonedCheckout1Template,
  OdAbandonedCheckout2Template,
  OdAbandonedCheckout3Template,
  // Pusti to, čo ťa ničí (SK)
  SkOrderPlacedTemplate,
  SkEbookDeliveryTemplate,
  SkShipmentNotificationTemplate,
  SkAbandonedCheckout1Template,
  SkAbandonedCheckout2Template,
  SkAbandonedCheckout3Template,
  // Lâche prise sur ce qui te détruit (FR)
  FrOrderPlacedTemplate,
  FrShipmentNotificationTemplate,
  FrAbandonedCheckout1Template,
  FrAbandonedCheckout2Template,
  FrAbandonedCheckout3Template,
  // Życie, jakiego nigdy sobie nie pozwoliłaś
  ZzOrderPlacedTemplate,
  ZzShipmentNotificationTemplate,
  ZzAbandonedCheckout1Template,
  ZzAbandonedCheckout2Template,
  ZzAbandonedCheckout3Template,
  ZzEbookDeliveryTemplate,
  ZvOrderPlacedTemplate,
  ZvShipmentNotificationTemplate,
  ZvAbandonedCheckout1Template,
  ZvAbandonedCheckout2Template,
  ZvAbandonedCheckout3Template,
  ZvEbookDeliveryTemplate,
  // Het Leven Dat Je Verdient
  HlOrderPlacedTemplate,
  HlEbookDeliveryTemplate,
  HlShipmentNotificationTemplate,
  HlAbandonedCheckout1Template,
  HlAbandonedCheckout2Template,
  HlAbandonedCheckout3Template,
  HlPaymentPendingTemplate,
  HlPaymentRecoveryTemplate,
  // Admin notification
  AdminOrderNotificationTemplate,
}
