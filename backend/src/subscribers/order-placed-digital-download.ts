import { Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates, resolveTemplateKey } from '../modules/email-notifications/templates'
import { DIGITAL_DOWNLOAD_MODULE } from '../modules/digital-download'
import type DigitalDownloadModuleService from '../modules/digital-download/service'
import { resolveBillingEntity } from '../utils/resolve-billing-entity'
import { logEmailActivity } from '../utils/email-logger'
import { renderEmailToHtml } from '../utils/render-email-html'
import { getProjectEmailConfig } from '../utils/project-email-config'
import crypto from 'crypto'

// Ebook files per project — these are the MinIO keys
const EBOOK_FILES_BY_PROJECT: Record<string, Array<{ key: string; title: string; description: string; size: string }>> = {
  loslatenboek: [
    {
      key: "e-books/De Overthinking Oplossing.pdf",
      title: "De Overthinking Oplossing",
      description: "E-book (PDF)",
      size: "1.3 MB",
    },
    {
      key: "e-books/Liefde zonder Onzin.pdf",
      title: "Liefde zonder Onzin",
      description: "E-book (PDF)",
      size: "13.8 MB",
    },
  ],
  dehondenbijbel: [
    {
      key: "e-books/Langlevendheid begint in de voerbak.pdf",
      title: "Langlevendheid begint in de voerbak",
      description: "E-book (PDF)",
      size: "3.7 MB",
    },
    {
      key: "e-books/TOP 20 spelletjes.pdf",
      title: "TOP 20 spelletjes",
      description: "E-book (PDF)",
      size: "798 KB",
    },
    {
      key: "e-books/Waroom Doet Hij Dat.pdf",
      title: "Waroom Doet Hij Dat",
      description: "E-book (PDF)",
      size: "4.0 MB",
    },
  ],
  'slapp-taget': [
    {
      key: "e-books/Karlek utan nonsens.pdf",
      title: "Kärlek utan nonsens",
      description: "E-bok (PDF)",
      size: "13.9 MB",
    },
    {
      key: "e-books/Losningen pa overanalysering.pdf",
      title: "Lösningen på överanalysering",
      description: "E-bok (PDF)",
      size: "1.3 MB",
    },
  ],
  'odpusc-ksiazka': [
    {
      key: "e-books/Koniec nadmiernym mysleniem.pdf",
      title: "Koniec nadmiernym myśleniem",
      description: "E-book (PDF)",
      size: "1.2 MB",
    },
    {
      key: "e-books/Milosc bez cenzury.pdf",
      title: "Miłość bez cenzury",
      description: "E-book (PDF)",
      size: "14.5 MB",
    },
  ],
  'lass-los': [
    {
      key: "e-books/Die Losung fur Uberdenkerinnen.pdf",
      title: "Die Lösung für Überdenkerinnen",
      description: "E-Book (PDF)",
      size: "1.4 MB",
    },
    {
      key: "e-books/LIEBE OHNE UNSINN.pdf",
      title: "Liebe ohne Unsinn",
      description: "E-Book (PDF)",
      size: "14.3 MB",
    },
  ],
  'psi-superzivot': [
    {
      key: "e-books/Dlouhovekost zacina v misce.pdf",
      title: "Dlouhověkost začíná v misce",
      description: "E-book (PDF)",
      size: "4.3 MB",
    },
    {
      key: "e-books/Proc to dela.pdf",
      title: "Proč to dělá",
      description: "E-book (PDF)",
      size: "4.3 MB",
    },
    {
      key: "e-books/TOP 20 her.pdf",
      title: "TOP 20 her",
      description: "E-book (PDF)",
      size: "782 KB",
    },
  ],
  'het-leven': [
    {
      key: "e-books/Verschuif Een Ding Verander Alles.pdf",
      title: "Verschuif Eén Ding, Verander Alles",
      description: "E-book (PDF)",
      size: "3.2 MB",
    },
    {
      key: "e-books/Niet Alles Verdient Een Plek.pdf",
      title: "Niet Alles Verdient Een Plek",
      description: "E-book (PDF)",
      size: "1.1 MB",
    },
  ],
  'zycie-zaslugy': [
    {
      key: "e-books/przesun-jedna-rzecz-zmien-wszystko.pdf",
      title: "Przesuń jedną rzecz, zmień wszystko",
      description: "E-book (PDF)",
      size: "13.2 MB",
    },
    {
      key: "e-books/nie-wszystko-zasluguje-na-miejsce.pdf",
      title: "Nie wszystko zasługuje na miejsce",
      description: "E-book (PDF)",
      size: "18.5 MB",
    },
  ],
  // Slipp taket på det som ødelegger deg (NO) — 2 gratis e-bøker
  'slipp-taket': [
    {
      key: "e-books/Losningen pa overtenking.pdf",
      title: "Løsningen på overtenking",
      description: "E-bok (PDF)",
      size: "1.4 MB",
    },
    {
      key: "e-books/Kjaerlighet uten sensur.pdf",
      title: "Kjærlighet uten sensur",
      description: "E-bok (PDF)",
      size: "17.1 MB",
    },
  ],
  'odpust-knizka': [
    {
      key: "e-books/Jak-prestat-nadmerne-premyslet-a-zacit-zit.pdf",
      title: "Jak přestat nadměrně přemýšlet a začít žít",
      description: "E-book (PDF)",
      size: "4.1 MB",
    },
    {
      key: "e-books/Laska-bez-cenzury.pdf",
      title: "Láska bez cenzury",
      description: "E-book (PDF)",
      size: "18.5 MB",
    },
  ],
  // Pusti to, čo ťa ničí (SK) — 2 bonusové e-knihy (zatiaľ CZ PDF, SK preklad neskôr)
  'pusti-to-sk': [
    {
      key: "e-books/Jak-prestat-nadmerne-premyslet-a-zacit-zit.pdf",
      title: "Ako prestať nadmerne premýšľať a začať žiť",
      description: "E-kniha (PDF)",
      size: "4.1 MB",
    },
    {
      key: "e-books/Laska-bez-cenzury.pdf",
      title: "Láska bez cenzúry",
      description: "E-kniha (PDF)",
      size: "18.5 MB",
    },
  ],
  // Engedd el, ami tönkretesz (HU) — 2 bonusz e-könyv
  'engedd-el': [
    {
      key: "e-books/A-tulgondolas-ellenszere.pdf",
      title: "A túlgondolás ellenszere",
      description: "E-könyv (PDF)",
      size: "501 KB",
    },
    {
      key: "e-books/Szerelem-cenzura-nelkul.pdf",
      title: "Szerelem cenzúra nélkül",
      description: "E-könyv (PDF)",
      size: "706 KB",
    },
  ],
}

// NOTE: no cross-language fallback. Unknown projects are skipped (and logged)
// rather than receiving wrong-language (e.g. Dutch) e-books.

// Storefront URLs per project
const STOREFRONT_URLS: Record<string, string> = {
  loslatenboek: process.env.LLWJK_STOREFRONT_URL || "https://storefront-production-fccf.up.railway.app",
  dehondenbijbel: process.env.DH_STOREFRONT_URL || process.env.STOREFRONT_URL || "https://www.dehondenbijbel.nl",
  'slapp-taget': process.env.ST_STOREFRONT_URL || "https://www.slapptagetboken.se",
  'slipp-taket': process.env.SL_STOREFRONT_URL || "https://www.slipptaketboken.no",
  'odpusc-ksiazka': process.env.OK_STOREFRONT_URL || "https://www.odpusc-ksiazka.pl",
  'lass-los': process.env.LL_STOREFRONT_URL || "https://www.jetztloslassen.de",
  'psi-superzivot': process.env.PS_STOREFRONT_URL || "https://www.psi-superzivot.cz",
  'het-leven': process.env.HL_STOREFRONT_URL || "https://www.pakjeleventerug.nl",
  'zycie-zaslugy': process.env.ZZ_STOREFRONT_URL || "https://www.najpierw-ja.pl",
  'odpust-knizka': process.env.OD_STOREFRONT_URL || "https://www.pusttocotenici.cz",
  'pusti-to-sk': process.env.PUSTI_TO_SK_STOREFRONT_URL || "https://www.pustitocotanici.sk",
  'engedd-el': process.env.EE_STOREFRONT_URL || "https://www.engeddelkonyv.hu",
}

// Localized email subjects per project
const EMAIL_SUBJECTS: Record<string, string> = {
  loslatenboek: 'Je e-books staan klaar! 📖',
  dehondenbijbel: 'Je e-book staat klaar! 📖',
  'slapp-taget': 'Dina e-böcker är redo! 📖',
  'slipp-taket': 'Dine e-bøker er klare! 📖',
  'odpusc-ksiazka': 'Twoje e-booki są gotowe! 📖',
  'lass-los': 'Deine E-Books sind bereit! 📖',
  'psi-superzivot': 'Tvoje e-booky jsou připravené! 📖',
  'het-leven': 'Je 2 gratis e-books staan klaar! 📖',
  'zycie-zaslugy': 'Twoje 2 darmowe e-booki są gotowe! 📖',
  'odpust-knizka': 'Tvoje e-booky jsou připravené! 📖',
  'pusti-to-sk': 'Tvoje e-knihy sú pripravené! 📖',
  'engedd-el': 'A 2 ingyenes e-könyved készen áll! 📖',
}

// Localized fallback first names
const DEFAULT_FIRST_NAMES: Record<string, string> = {
  loslatenboek: 'daar',
  dehondenbijbel: 'daar',
  'slapp-taget': 'där',
  'slipp-taket': 'der',
  'odpusc-ksiazka': 'tam',
  'lass-los': 'dort',
  'psi-superzivot': 'tam',
  'het-leven': 'daar',
  'zycie-zaslugy': 'tam',
  'odpust-knizka': 'tam',
  'pusti-to-sk': 'tam',
  'engedd-el': 'Olvasó',
}

export async function sendEbookDelivery(orderId: string, container: any, eventName: string) {
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
  const downloadService = container.resolve(DIGITAL_DOWNLOAD_MODULE) as DigitalDownloadModuleService

  try {
    const order = await orderModuleService.retrieveOrder(orderId, {
      relations: ['items', 'shipping_address'],
    })

    // Guard: skip if e-books already sent (prevent duplicate sends from webhook retries or dual events)
    if (order.metadata?.ebook_sent) {
      console.log(`[digital-download] E-books already sent for order ${order.id}, skipping (event: ${eventName})`)
      return
    }

    // Optimistic lock: set ebook_sent flag BEFORE sending to prevent race condition
    // between payment.captured and order.placed-fallback subscribers
    try {
      const { Pool } = require("pg")
      const lockPool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
      const lockResult = await lockPool.query(
        `UPDATE "order" SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{ebook_sent}', 'true'), updated_at = NOW() WHERE id = $1 AND (metadata IS NULL OR NOT (metadata ? 'ebook_sent') OR metadata->>'ebook_sent' != 'true') RETURNING id`,
        [order.id]
      )
      await lockPool.end()
      if (lockResult.rowCount === 0) {
        console.log(`[digital-download] E-books already claimed by another subscriber for order ${order.id}, skipping (event: ${eventName})`)
        return
      }
    } catch (lockErr: any) {
      console.warn(`[digital-download] Could not acquire lock for order ${order.id}: ${lockErr.message}, proceeding anyway`)
    }

    // Project-specific config
    const projectConfig = getProjectEmailConfig(order)
    const projectId = projectConfig.project

    // Get e-book files for this project — NO cross-language fallback
    const ebookFiles = EBOOK_FILES_BY_PROJECT[projectId]

    // Skip if no e-book files configured for this project yet
    if (!ebookFiles || !ebookFiles.length) {
      console.log(`[digital-download] No e-book files configured for project "${projectId}", skipping for order ${order.id}`)
      return
    }

    // Generate unique token
    const token = crypto.randomUUID()

    // Set expiry to 30 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 30)

    // Create digital download record (store project_id in metadata for frontend theming)
    await downloadService.createDigitalDownloads({
      order_id: order.id,
      token,
      email: order.email,
      files: ebookFiles as any,
      expires_at: expiresAt,
      download_count: 0,
      metadata: { project_id: projectId },
    })

    const storefrontUrl = STOREFRONT_URLS[projectId] || STOREFRONT_URLS.loslatenboek
    const downloadUrl = `${storefrontUrl}/download/${token}`

    // Get customer first name — safely handle missing shipping address
    let firstName = DEFAULT_FIRST_NAMES[projectId] || 'daar'
    try {
      if (order.shipping_address?.id) {
        const shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(
          order.shipping_address.id
        )
        if (shippingAddress?.first_name) {
          firstName = shippingAddress.first_name
        }
      }
    } catch (addrErr: any) {
      console.warn(`[digital-download] Could not retrieve shipping address: ${addrErr.message}`)
    }

    // Resolve billing entity for footer
    let billingEntity: any = null
    try {
      billingEntity = await resolveBillingEntity(container, orderId)
    } catch (err: any) {
      console.warn('[digital-download] Could not resolve billing entity:', err.message)
    }

    // Send ebook delivery email (project-specific template)
    const templateKey = resolveTemplateKey(EmailTemplates.EBOOK_DELIVERY, projectConfig.project)
    const emailSubject = EMAIL_SUBJECTS[projectId] || EMAIL_SUBJECTS.loslatenboek

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
        firstName,
        downloadUrl,
        expiresAt: expiresAt.toISOString(),
        billingEntity,
      },
    })

    // Render HTML for email preview in timeline
    const emailData = {
      emailOptions: {
        replyTo: projectConfig.replyTo,
        subject: emailSubject,
      },
      firstName,
      downloadUrl,
      expiresAt: expiresAt.toISOString(),
      billingEntity,
    }
    const htmlBody = await renderEmailToHtml(templateKey, emailData).catch(() => '')

    await logEmailActivity(orderModuleService, orderId, {
      template: "ebook_delivery",
      subject: emailSubject,
      to: order.email,
      status: "sent",
      ...(htmlBody ? { html_body: htmlBody } : {}),
    }).catch((err) => console.warn('[digital-download] Could not log email activity:', err.message))

    console.log(`[digital-download] Created download token ${token} for order ${order.id} (project: ${projectId}, trigger: ${eventName})`)
  } catch (error: any) {
    console.error(`[digital-download] Error creating digital download (trigger: ${eventName}):`, error)
    await logEmailActivity(orderModuleService, orderId, {
      template: "ebook_delivery",
      subject: "E-book delivery",
      to: "",
      status: "failed",
      error_message: error.message,
    }).catch(() => {})
  }
}

// Handler for payment.captured (Stripe, PayPal, Mollie, Comgate, Airwallex, Klarna capture)
export default async function orderPlacedDigitalDownloadHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  await sendEbookDelivery(data.id, container, 'payment.captured')
}

export const config: SubscriberConfig = {
  event: 'payment.captured',
}
