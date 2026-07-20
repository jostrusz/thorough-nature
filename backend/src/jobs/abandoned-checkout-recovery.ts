import { MedusaContainer } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EmailTemplates, resolveTemplateKey } from "../modules/email-notifications/templates"
import { displayBookQty } from "../utils/bundle-book-count"

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
 * Lass los uses project-specific templates (ll-abandoned-checkout-1/2/3).
 * Het Leven Dat Je Verdient uses project-specific templates (hl-abandoned-checkout-1/2/3).
 * Pusť to, co tě ničí uses project-specific templates (od-abandoned-checkout-1/2/3).
 * Pusti to, čo ťa ničí uses project-specific templates (sk-abandoned-checkout-1/2/3).
 * Engedd el, ami tönkretesz uses project-specific templates (eng-abandoned-checkout-1/2/3).
 * Loslatenboek uses the lb-abandoned-checkout-1/2/3 sequence (default fallback).
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

/** Lass los, was dich kaputt macht (lass-los) 3-step sequence */
const LL_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.LL_ABANDONED_CHECKOUT_1,
    subject: (name) => name ? `Hallo ${name}, dein Paket steht bereit! 📦` : `Dein Paket steht bereit! 📦`,
    preview: "Dein Buch liegt verpackt und wartet auf dich!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.LL_ABANDONED_CHECKOUT_2,
    subject: (name) => name ? `${name}, die Geschichte hinter diesem Buch` : `Die Geschichte hinter diesem Buch`,
    preview: "Schon nach einer Woche fühlte ich mich leichter...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.LL_ABANDONED_CHECKOUT_3,
    subject: (name) => name ? `Letzte Chance, ${name} — dein Warenkorb wird freigegeben` : `Letzte Chance — dein Warenkorb wird freigegeben`,
    preview: "Noch 24 Stunden — danach wird dein Warenkorb freigegeben.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Odpuść to, co cię niszczy (odpusc-ksiazka) 3-step sequence */
const OK_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.OK_ABANDONED_CHECKOUT_1,
    subject: (name) => `Cześć ${name}, Twoja książka czeka na Ciebie! 📦`,
    preview: "Twoja książka jest zapakowana i czeka na Ciebie!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.OK_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, historia stojąca za tą książką`,
    preview: "Już po tygodniu poczułam się lżejsza niż od dawna...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.OK_ABANDONED_CHECKOUT_3,
    subject: (name) => `Ostatnia szansa, ${name} — Twój koszyk zostanie zwolniony`,
    preview: "Jeszcze 24 godziny — potem muszę zwolnić Twój koszyk.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Pusť to, co tě ničí (odpust-knizka) 3-step sequence */
const OD_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.OD_ABANDONED_CHECKOUT_1,
    subject: (name) => `Ahoj ${name}, tvoje kniha na tebe čeká! 📦`,
    preview: "Tvoje kniha je zabalená a čeká jen na tebe!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.OD_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, příběh, který stojí za touto knihou`,
    preview: "Už po týdnu jsem se cítila lehčeji než kdy dřív...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.OD_ABANDONED_CHECKOUT_3,
    subject: (name) => `Poslední šance, ${name} — tvůj košík brzy uvolníme`,
    preview: "Zbývá 24 hodin — pak musím tvůj košík uvolnit.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Kočičí bible (kocici-bible) 3-step sequence */
const KB_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.KB_ABANDONED_CHECKOUT_1,
    subject: (name) => name ? `Ahoj ${name}, tvoje kniha na tebe čeká! 📦` : `Tvoje kniha na tebe čeká! 📦`,
    preview: "Kočičí bible je zabalená a čeká jen na tebe!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.KB_ABANDONED_CHECKOUT_2,
    subject: (name) => name ? `${name}, příběh, který stojí za touto knihou` : `Příběh, který stojí za touto knihou`,
    preview: "Kočka nám čůrala za gauč tři roky. Po dvou týdnech je klid...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.KB_ABANDONED_CHECKOUT_3,
    subject: (name) => name ? `Poslední šance, ${name} — tvůj košík brzy uvolníme` : `Poslední šance — tvůj košík brzy uvolníme`,
    preview: "Zbývá 24 hodin — pak musím tvůj košík uvolnit.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Biblia kotów (biblia-kotow) 3-step sequence */
const BK_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.BK_ABANDONED_CHECKOUT_1,
    subject: (name) => name ? `Cześć ${name}, Twoja książka na Ciebie czeka! 📦` : `Twoja książka na Ciebie czeka! 📦`,
    preview: "Biblia kotów jest spakowana i czeka tylko na Ciebie!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.BK_ABANDONED_CHECKOUT_2,
    subject: (name) => name ? `${name}, historia, która stoi za tą książką` : `Historia, która stoi za tą książką`,
    preview: "Kot sikał nam za kanapę przez trzy lata. Po dwóch tygodniach jest spokój...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.BK_ABANDONED_CHECKOUT_3,
    subject: (name) => name ? `Ostatnia szansa, ${name} — wkrótce zwolnimy Twój koszyk` : `Ostatnia szansa — wkrótce zwolnimy Twój koszyk`,
    preview: "Zostały 24 godziny — potem muszę zwolnić Twój koszyk.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Pusti to, čo ťa ničí (pusti-to-sk) 3-step sequence */
const SK_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.SK_ABANDONED_CHECKOUT_1,
    subject: (name) => `Ahoj ${name}, tvoja kniha na teba čaká! 📦`,
    preview: "Tvoja kniha je zabalená a čaká len na teba!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.SK_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, príbeh, ktorý stojí za touto knihou`,
    preview: "Už po týždni som sa cítila ľahšie než kedy predtým...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.SK_ABANDONED_CHECKOUT_3,
    subject: (name) => `Posledná šanca, ${name} — tvoj košík čoskoro uvoľníme`,
    preview: "Ostáva 24 hodín — potom musím tvoj košík uvoľniť.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Engedd el, ami tönkretesz (engedd-el) 3-step sequence */
const ENG_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.ENG_ABANDONED_CHECKOUT_1,
    subject: (name) => `Szia ${name}, a könyved már csak rád vár! 📦`,
    preview: "A könyved be van csomagolva, és már csak rád vár!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.ENG_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, a történet, ami e könyv mögött áll`,
    preview: "Miért írtam meg ezt a könyvet — és mi változott meg utána...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.ENG_ABANDONED_CHECKOUT_3,
    subject: (name) => `Utolsó esély, ${name} — a kosaradat hamarosan felszabadítjuk`,
    preview: "Még 24 óra — utána fel kell szabadítanom a kosaradat.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Lâche prise sur ce qui te détruit (lache-livre) 3-step sequence */
const FR_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.FR_ABANDONED_CHECKOUT_1,
    subject: (name) => `Bonjour ${name}, ton livre t'attend ! 📦`,
    preview: "Ton livre est emballé et n'attend plus que toi !",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.FR_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, l'histoire derrière ce livre`,
    preview: "Après une semaine à peine, je me sentais plus légère que jamais...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.FR_ABANDONED_CHECKOUT_3,
    subject: (name) => `Dernière chance, ${name} — ton panier sera bientôt vidé`,
    preview: "Il reste 24 heures — ensuite ton panier sera vidé.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Het Leven Dat Je Verdient 3-step sequence (Anna de Vries) */
const HL_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.HL_ABANDONED_CHECKOUT_1,
    subject: (name) => `Hoi ${name}, je boek staat klaar 📦`,
    preview: "Je boek ligt klaar — je hoeft alleen nog op verzenden te drukken.",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.HL_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, het verhaal achter dit boek`,
    preview: "Het verhaal achter dit boek — en waarom ik het móést schrijven.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.HL_ABANDONED_CHECKOUT_3,
    subject: (name) => `Laatste kans, ${name} — je winkelwagen wordt vrijgegeven`,
    preview: "Nog 24 uur — daarna moet ik je winkelwagen vrijgeven.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Życie, jakiego nigdy sobie nie pozwoliłaś (zycie-zaslugy) 3-step sequence */
const ZZ_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.ZZ_ABANDONED_CHECKOUT_1,
    subject: (name) => `Cześć ${name}, Twoja książka czeka na Ciebie! 📦`,
    preview: "Twoja książka jest zapakowana i czeka na Ciebie!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.ZZ_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, historia stojąca za tą książką`,
    preview: "Już po tygodniu poczułam się lżejsza niż od dawna...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.ZZ_ABANDONED_CHECKOUT_3,
    subject: (name) => `Ostatnia szansa, ${name} — Twój koszyk zostanie zwolniony`,
    preview: "Jeszcze 24 godziny — potem muszę zwolnić Twój koszyk.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Život, jaký si zasloužíš (zivot-zaslugy, CZ) 3-step sequence */
const ZV_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.ZV_ABANDONED_CHECKOUT_1,
    subject: (name) => `Ahoj ${name}, tvoje kniha na tebe čeká! 📦`,
    preview: "Tvoje kniha je zabalená a čeká jen na tebe!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.ZV_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, příběh, který stojí za touhle knihou`,
    preview: "Už po týdnu jsem se cítila lehčí než za poslední roky...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.ZV_ABANDONED_CHECKOUT_3,
    subject: (name) => `Poslední šance, ${name} — tvůj košík se brzy uvolní`,
    preview: "Zbývá 24 hodin — pak musím tvůj košík uvolnit.",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step2_at),
  },
]

/** Loslatenboek 3-step sequence */
const LB_STEPS: StepConfig[] = [
  {
    step: 1,
    templateKey: EmailTemplates.LB_ABANDONED_CHECKOUT_1,
    subject: (name) => `Hoi ${name}, je boek staat klaar! 📦`,
    preview: "Je boek ligt ingepakt en wacht op jou!",
    delayMs: THIRTY_MINUTES_MS,
    delayFrom: (_meta, abandonedAt) => abandonedAt,
  },
  {
    step: 2,
    templateKey: EmailTemplates.LB_ABANDONED_CHECKOUT_2,
    subject: (name) => `${name}, het verhaal achter dit boek`,
    preview: "Na 1 week voelde ik me al lichter dan in jaren...",
    delayMs: TWENTY_FOUR_HOURS_MS,
    delayFrom: (meta) => new Date(meta.recovery_email_step1_at),
  },
  {
    step: 3,
    templateKey: EmailTemplates.LB_ABANDONED_CHECKOUT_3,
    subject: (name) => `Laatste kans, ${name} — je winkelwagen wordt vrijgegeven`,
    preview: "Nog 24 uur — daarna moet ik je winkelwagen vrijgeven.",
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

    // ── Build set of emails that already have a completed order ──
    const abandonedEmails = [...new Set(
      (carts || [])
        .filter((c: any) => c.metadata?.abandoned_checkout && c.email && !c.completed_at)
        .map((c: any) => c.email.toLowerCase())
    )]

    const purchasedEmails = new Set<string>()
    if (abandonedEmails.length > 0) {
      try {
        const { data: completedOrders } = await query.graph({
          entity: "order",
          fields: ["email"],
          filters: { email: abandonedEmails },
          pagination: { skip: 0, take: 1000 },
        })
        for (const order of completedOrders || []) {
          if (order.email) purchasedEmails.add(order.email.toLowerCase())
        }
        if (purchasedEmails.size > 0) {
          logger.info(`[Abandoned Cart] Found ${purchasedEmails.size} emails with completed orders — will skip recovery emails for them`)
        }
      } catch (e: any) {
        logger.warn(`[Abandoned Cart] Could not check completed orders: ${e.message}`)
      }
    }

    for (const cart of carts || []) {
      const meta = cart.metadata || {}

      // Skip: not an abandoned checkout cart
      if (!meta.abandoned_checkout) continue

      // Skip: no email on cart
      if (!cart.email) continue

      // Skip: cart was completed
      if (cart.completed_at) continue

      // Skip: customer already purchased (has a completed order)
      if (purchasedEmails.has(cart.email.toLowerCase())) continue

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

      // ── Lass los, was dich kaputt macht: 3-step sequence ──
      if (projectId === "lass-los") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = LL_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = (cart.shipping_address?.first_name || "").trim()
        const checkoutUrl = meta.checkout_url || "https://www.jetztloslassen.de/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Lass los, was dich kaputt macht"
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
            from: "Joris de Vries - Lass los, was dich kaputt macht <buch@jetztloslassen.de>",
            data: {
              emailOptions: {
                replyTo: "buch@jetztloslassen.de",
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
            `[Abandoned Cart] LL step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send LL step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Odpuść to, co cię niszczy: 3-step sequence ──
      if (projectId === "odpusc-ksiazka") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = OK_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = cart.shipping_address?.first_name || "tam"
        const checkoutUrl = meta.checkout_url || "https://odpusc-ksiazka.pl/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Odpuść to, co cię niszczy"
        // Calculate total price from all cart items (quantity × unit_price)
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? Math.round(cartTotal).toString()
          : "129"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Joris De Vries - Odpuść to, co cię niszczy <biuro@odpusc-ksiazka.pl>",
            data: {
              emailOptions: {
                replyTo: "biuro@odpusc-ksiazka.pl",
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
            `[Abandoned Cart] OK step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send OK step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Pusť to, co tě ničí: 3-step sequence ──
      if (projectId === "odpust-knizka") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = OD_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = cart.shipping_address?.first_name || "tam"
        const checkoutUrl = meta.checkout_url || "https://www.pusttocotenici.cz/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Pusť to, co tě ničí"
        // Calculate total price from all cart items (quantity × unit_price)
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? Math.round(cartTotal).toString()
          : "749"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Joris de Vries - Pusť to, co tě ničí <podpora@pusttocotenici.cz>",
            data: {
              emailOptions: {
                replyTo: "podpora@pusttocotenici.cz",
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
            `[Abandoned Cart] OD step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send OD step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Kočičí bible: 3-step sequence ──
      if (projectId === "kocici-bible") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = KB_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = cart.shipping_address?.first_name || "tam"
        const checkoutUrl = meta.checkout_url || "https://www.kocicibible.cz/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Kočičí bible"
        // Calculate total price from all cart items (quantity × unit_price)
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? Math.round(cartTotal).toString()
          : "550"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Michal Peterka - Kočičí bible <peterka@kocicibible.cz>",
            data: {
              emailOptions: {
                replyTo: "peterka@kocicibible.cz",
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
            `[Abandoned Cart] KB step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send KB step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Biblia kotów: 3-step sequence ──
      if (projectId === "biblia-kotow") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = BK_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = cart.shipping_address?.first_name || ""
        const checkoutUrl = meta.checkout_url || "https://biblia-kotow.pl/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Biblia kotów"
        // Calculate total price from all cart items (quantity × unit_price)
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? Math.round(cartTotal).toString()
          : "89"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Michał Peterka - Biblia kotów <ksiazka@biblia-kotow.pl>",
            data: {
              emailOptions: {
                replyTo: "ksiazka@biblia-kotow.pl",
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
            `[Abandoned Cart] BK step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send BK step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Pusti to, čo ťa ničí: 3-step sequence ──
      if (projectId === "pusti-to-sk") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = SK_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = cart.shipping_address?.first_name || "tam"
        const checkoutUrl = meta.checkout_url || "https://www.pustitocotanici.sk/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Pusti to, čo ťa ničí"
        // Calculate total price from all cart items (quantity × unit_price)
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? Math.round(cartTotal).toString()
          : "749"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Joris de Vries - Pusti to, čo ťa ničí <podpora@pustitocotanici.sk>",
            data: {
              emailOptions: {
                replyTo: "podpora@pustitocotanici.sk",
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
            `[Abandoned Cart] SK step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send SK step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Engedd el, ami tönkretesz: 3-step sequence ──
      if (projectId === "engedd-el") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = ENG_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = cart.shipping_address?.first_name || "kedves olvasó"
        const checkoutUrl = meta.checkout_url || "https://www.engeddelkonyv.hu/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Engedd el, ami tönkretesz"
        // Calculate total price from all cart items (quantity × unit_price)
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? Math.round(cartTotal).toString()
          : "10999"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Joris de Vries - Engedd el, ami tönkretesz <info@engeddelkonyv.hu>",
            data: {
              emailOptions: {
                replyTo: "info@engeddelkonyv.hu",
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
            `[Abandoned Cart] ENG step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send ENG step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Lâche prise sur ce qui te détruit: 3-step sequence ──
      if (projectId === "lache-livre") {
        // All 3 steps sent? Done.
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = FR_STEPS[currentStep] // currentStep=0 → step 1, etc.

        // Check if enough time has passed
        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue // invalid date, skip
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        // Extract customer data
        const firstName = cart.shipping_address?.first_name || ""
        const checkoutUrl = meta.checkout_url || "https://lacheprise-livre.fr/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Lâche prise sur ce qui te détruit"
        // Calculate total price from all cart items (quantity × unit_price)
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? Math.round(cartTotal).toString()
          : "36"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Joris de Vries - Lâche prise sur ce qui te détruit <joris@lacheprise-livre.fr>",
            data: {
              emailOptions: {
                replyTo: "joris@lacheprise-livre.fr",
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
            `[Abandoned Cart] FR step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send FR step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Het Leven Dat Je Verdient: 3-step sequence ──
      if (projectId === "het-leven") {
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = HL_STEPS[currentStep]

        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        const firstName = cart.shipping_address?.first_name || "daar"
        const checkoutUrl = meta.checkout_url || "https://www.pakjeleventerug.nl/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Het Leven Dat Je Verdient"
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? cartTotal.toFixed(2).replace(".", ",")
          : "36,00"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Het Leven Dat Je Verdient <annadevries@pakjeleventerug.nl>",
            data: {
              emailOptions: {
                replyTo: "annadevries@pakjeleventerug.nl",
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

          await cartModuleService.updateCarts(cart.id, {
            metadata: {
              ...meta,
              recovery_email_step: nextStepConfig.step,
              [`recovery_email_step${nextStepConfig.step}_at`]: now.toISOString(),
              recovery_email_sent: true,
              recovery_email_sent_at: meta.recovery_email_sent_at || now.toISOString(),
            },
          })

          sentCount++
          logger.info(
            `[Abandoned Cart] HL step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send HL step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Życie, jakiego nigdy sobie nie pozwoliłaś: 3-step sequence ──
      if (projectId === "zycie-zaslugy") {
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = ZZ_STEPS[currentStep]

        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        const firstName = cart.shipping_address?.first_name || "tam"
        const checkoutUrl = meta.checkout_url || "https://www.najpierw-ja.pl/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Życie, jakiego nigdy sobie nie pozwoliłaś"
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? cartTotal.toFixed(0)
          : "129"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Anna de Vries <anna@najpierw-ja.pl>",
            data: {
              emailOptions: {
                replyTo: "anna@najpierw-ja.pl",
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

          await cartModuleService.updateCarts(cart.id, {
            metadata: {
              ...meta,
              recovery_email_step: nextStepConfig.step,
              [`recovery_email_step${nextStepConfig.step}_at`]: now.toISOString(),
              recovery_email_sent: true,
              recovery_email_sent_at: meta.recovery_email_sent_at || now.toISOString(),
            },
          })

          sentCount++
          logger.info(
            `[Abandoned Cart] ZZ step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send ZZ step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Život, jaký si zasloužíš (CZ): 3-step sequence ──
      if (projectId === "zivot-zaslugy") {
        if (currentStep >= 3) {
          skippedCount++
          continue
        }

        const nextStepConfig = ZV_STEPS[currentStep]

        const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
        if (isNaN(referenceTime.getTime())) continue
        if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

        const firstName = cart.shipping_address?.first_name || "tam"
        const checkoutUrl = meta.checkout_url || "https://www.nejdriv-ja.cz/checkout"
        const mainItem = (cart.items || [])[0]
        const productName = mainItem?.variant?.product?.title || mainItem?.title || "Život, jaký si zasloužíš"
        // Zákazník si v košíku vybírá bundle 1–4 knih jako JEDNU položku s quantity=1,
        // takže surové množství počet knih neřekne — musí se odvodit ze SKU varianty.
        const bookCount = mainItem ? displayBookQty(mainItem) : 1
        const cartTotal = (cart.items || []).reduce((sum: number, item: any) => {
          return sum + (Number(item.unit_price) || 0) * (Number(item.quantity) || 1)
        }, 0)
        const productPrice = cartTotal > 0
          ? cartTotal.toFixed(0)
          : "749"
        const productImage = mainItem?.variant?.product?.thumbnail || ""

        try {
          await notificationModuleService.createNotifications({
            to: cart.email,
            channel: "email",
            template: nextStepConfig.templateKey,
            from: "Anna de Vries <anna@nejdriv-ja.cz>",
            data: {
              emailOptions: {
                replyTo: "anna@nejdriv-ja.cz",
                subject: nextStepConfig.subject(firstName),
              },
              firstName,
              checkoutUrl,
              productName,
              productPrice,
              productImage,
              bookCount,
              preview: nextStepConfig.preview,
            },
          })

          await cartModuleService.updateCarts(cart.id, {
            metadata: {
              ...meta,
              recovery_email_step: nextStepConfig.step,
              [`recovery_email_step${nextStepConfig.step}_at`]: now.toISOString(),
              recovery_email_sent: true,
              recovery_email_sent_at: meta.recovery_email_sent_at || now.toISOString(),
            },
          })

          sentCount++
          logger.info(
            `[Abandoned Cart] ZV step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id} (${bookCount}× kniha)`
          )
        } catch (emailError: any) {
          logger.error(
            `[Abandoned Cart] Failed to send ZV step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
          )
        }
        continue
      }

      // ── Loslatenboek: 3-step sequence ──
      // All 3 steps sent? Done.
      if (currentStep >= 3) {
        skippedCount++
        continue
      }

      const nextStepConfig = LB_STEPS[currentStep] // currentStep=0 → step 1, etc.

      // Check if enough time has passed
      const referenceTime = nextStepConfig.delayFrom(meta, abandonedAt)
      if (isNaN(referenceTime.getTime())) continue // invalid date, skip
      if ((now.getTime() - referenceTime.getTime()) < nextStepConfig.delayMs) continue

      // Extract customer data
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

      try {
        await notificationModuleService.createNotifications({
          to: cart.email,
          channel: "email",
          template: nextStepConfig.templateKey,
          from: "Joris de Vries - Laat los wat je kapotmaakt <boek@loslatenboek.nl>",
          data: {
            emailOptions: {
              replyTo: "boek@loslatenboek.nl",
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
          `[Abandoned Cart] LB step ${nextStepConfig.step} email sent to ${cart.email} for cart ${cart.id}`
        )
      } catch (emailError: any) {
        logger.error(
          `[Abandoned Cart] Failed to send LB step ${nextStepConfig.step} to ${cart.email}: ${emailError.message}`
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
