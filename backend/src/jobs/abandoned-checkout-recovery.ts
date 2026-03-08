import { MedusaContainer } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EmailTemplates, resolveTemplateKey } from "../modules/email-notifications/templates"

/**
 * Abandoned Checkout Recovery — 3-email sequence
 *
 * Runs every 15 minutes. Finds abandoned carts and sends up to 3 recovery emails:
 *
 *   Step 1: 30 min after abandonment   → "Je pakketje staat klaar!"
 *   Step 2: 24h after step 1 sent      → "Het verhaal achter dit boek" (social proof)
 *   Step 3: 24h after step 2 sent      → "Laatste kans" (urgency/FOMO)
 *
 * De Hondenbijbel uses project-specific templates (dh-abandoned-checkout-1/2/3).
 * Loslatenboek uses the original single template (abandoned-checkout).
 *
 * Tracking metadata on cart:
 *   - recovery_email_step: number (0 = none sent, 1/2/3 = last step sent)
 *   - recovery_email_step1_at: ISO timestamp
 *   - recovery_email_step2_at: ISO timestamp
 *   - recovery_email_step3_at: ISO timestamp
 *   - recovery_email_sent: boolean (legacy, kept for backwards compat)
 */

interface StepConfig {
  step: number
  templateKey: string
  subject: (firstName: string) => string
  preview: string
  /** Minimum ms that must have passed since the relevant reference time */
  delayMs: number
  /** Which timestamp to measure the delay from */
  delayFrom: (meta: Record<string, any>, abandonedAt: Date) => Date
}

const THIRTY_MINUTES_MS = 30 * 60 * 1000
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000
const SEVENTY_TWO_HOURS_MS = 72 * 60 * 60 * 1000

/** De Hondenbijbel 3-step sequence */
const DH_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.DH_ABANDONED_CHECKOUT_1,
    subject: (name) => `Hoi ${name}, je pakketje staat klaar! 📦`,
    preview: "Je Hondenbijbel ligt ingepakt en wacht op jou!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.DH_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, dit is het verhaal achter De Hondenbijbel`,
    preview: "Na 1 week liep onze hond al rustiger aan de lijn...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.DH_ABANDONED_CHECKOUT_3,
    subject: (name) => `Laatste kans, ${name} — je winkelwagen wordt vrijgegeven`,
    preview: "Nog 24 uur — daarna moet ik je winkelwagen vrijgeven.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Släpp Taget 3-step sequence */
const ST_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.ST_ABANDONED_CHECKOUT_1,
    subject: (name) => `Hej ${name}, din bok väntar på dig! 📦`,
    preview: "Din bok ligger inpackad och väntar på dig!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.ST_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, historien bakom Släpp Taget`,
    preview: "Efter bara en vecka kände jag mig lättare än på länge...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.ST_ABANDONED_CHECKOUT_3,
    subject: (name) => `Sista chansen, ${name} — din varukorg frigörs snart`,
    preview: "Ännu 24 timmar — sedan måste jag frigöra din varukorg.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

export default async function abandonedCheckoutRecovery(container: MedusaContainer) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const cartModuleService = container.resolve(Modules.CART) as any
  const logger = container.resolve("logger") as any

  try {
    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "metadata",
        "created_at",
        "completed_at",
        "shipping_address.*",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
      ],
      filters: {},
      pagination: { order: { created_at: "DESC" }, skip: 0, take: 500 },
    })

    const now = new Date()
    let sentCount = 0
    let skippedCount = 0

    for (const cart of carts || []) {
      const meta = cart.metadata || {}

      // Skip: not an abandoned checkout cart
      if (!meta.abandoned_checkout) continue

      // Skip: no email on cart
      if (!cart.email) continue

      // Skip: cart was completed
      if (cart.completed_at) continue

      const abandonedAt = new Date(meta.abandoned_at || cart.created_at)

      // Skip: older than 72 hours (stale)
      if ((now.getTime() - abandonedAt.getTime()) > SEVENTY_TWO_HOURS_MS) continue

      const projectId = meta.project_id || "loslatenboek"
      const currentStep = Number(meta.recovery_email_step) || 0

      // ── De Hondenbijbel: 3-step sequence ──
      if (projectId === "dehondenbijbel") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = DH_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = cart.shipping_address?.first_name || "daar"
        const checkoutUrl = meta.checkout_url || "https://dehondenbijbel.nl/p/dehondenbijbel/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "De Hondenbijbel"
        // Calculate total price from all cart items (quantity × unit_price)
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? cartTotal.toFixed(2).replace(".", ",")
          : "35,00"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            data: {
              emailOptions: {
                replyTo: "support@dehondenbijbel.nl",
                subject: nextStepConfig.subject(firstName),
              },
              firstName,
              checkoutUrl,
              productName,
              productPrice,
              productImage,
              preview: nextStepConfig.preview,
            },
          })

          // Update metadata with step tracking
          await cartModuleService.updateCarts(cart.id, {
            metadata: {
              ...meta,
              recovery_email_step: nextStepConfig.step,
              [`recovery_email_step${nextStepConfig.step}_at`]: now.toISOString(),
              // Legacy compat: mark as sent after step 1
              recovery_email_sent: true,
              recovery_email_sent_at: meta.recovery_email_sent_at || now.toISOString(),
            },
          })

          sentCount++
          logger.info(
            `[Abandoned Cart] DH step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send DH step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Släpp Taget: 3-step sequence ──
      if (projectId === "slapp-taget") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = ST_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = cart.shipping_address?.first_name || "där"
        const checkoutUrl = meta.checkout_url || "https://www.slapptagetboken.se/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Släpp Taget"
        // Calculate total price from all cart items (quantity × unit_price)
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? Math.round(cartTotal).toString()
          : "399"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Joris de Vries - Släpp taget om det som förstör dig <hej@slapptagetboken.se>",
            data: {
              emailOptions: {
                replyTo: "hej@slapptagetboken.se",
                subject: nextStepConfig.subject(firstName),
              },
              firstName,
              checkoutUrl,
              productName,
              productPrice,
              productImage,
              preview: nextStepConfig.preview,
            },
          })

          // Update metadata with step tracking
          await cartModuleService.updateCarts(cart.id, {
            metadata: {
              ...meta,
              recovery_email_step: nextStepConfig.step,
              [`recovery_email_step${nextStepConfig.step}_at`]: now.toISOString(),
              // Legacy compat: mark as sent after step 1
              recovery_email_sent: true,
              recovery_email_sent_at: meta.recovery_email_sent_at || now.toISOString(),
            },
          })

          sentCount++
          logger.info(
            `[Abandoned Cart] ST step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send ST step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Loslatenboek: single email (original behavior) ──
      if (meta.recovery_email_sent) {
        skippedCount++
        continue
      }

      const ONE_HOUR_MS = 60 * 60 * 1000
      if ((now.getTime() - abandonedAt.getTime()) < ONE_HOUR_MS) continue
      if ((now.getTime() - abandonedAt.getTime()) > 48 * ONE_HOUR_MS) continue

      const firstName = cart.shipping_address?.first_name || "daar"
      const checkoutUrl = meta.checkout_url || "https://loslatenboek.nl/p/loslatenboek/checkout"
      const mainItem = (cart.items || [])[0]
      const productName = mainItem?.variant?.product?.title || mainItem?.title || "Laat Los Wat Je Kapotmaakt"
      // Calculate total price from all cart items (quantity × unit_price)
      const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
        return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
      }, 0)
      const productPrice = cartTotal > 0
        ? cartTotal.toFixed(2).replace(".", ",")
        : "35,00"
      const productImage = mainItem?.variant?.product?.thumbnail || ""
      const templateKey = resolveTemplateKey(EmailTemplates.ABANDONED_CHECKOUT, projectId)

      try {
        await notificationModuleService.createNotifications({
          to: cart.email,
          channel: "email",
          template: templateKey,
          data: {
            emailOptions: {
              replyTo: "devries@loslatenboek.nl",
              subject: `Hoi ${firstName}, je bestelling wacht nog op je!`,
            },
            firstName,
            checkoutUrl,
            productName,
            productPrice,
            productImage,
            preview: "Je hebt nog iets in je winkelwagen laten liggen!",
          },
        })

        await cartModuleService.updateCarts(cart.id, {
          metadata: {
            ...meta,
            recovery_email_sent: true,
            recovery_email_sent_at: now.toISOString(),
          },
        })

        sentCount++
        logger.info(
          `[Abandoned Cart] Recovery email sent to ${cart.email} for cart ${cart.id}`
        )
      } catch (emailError: any) {
        logger.error(
          `[Abandoned Cart] Failed to send email to ${cart.email}: ${emailError.message}`
        )
      }
    }

    if (sentCount > 0 || skippedCount > 0) {
      logger.info(
        `[Abandoned Cart] Job completed: ${sentCount} emails sent, ${skippedCount} fully processed`
      )
    }
  } catch (error: any) {
    logger.error(`[Abandoned Cart] Job failed: ${error.message}`)
  }
}

export const config = {
  name: "abandoned-checkout-recovery",
  schedule: "*/15 * * * *", // Every 15 minutes
}
