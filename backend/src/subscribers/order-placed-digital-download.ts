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
      size: "2.4 MB",
    },
    {
      key: "e-books/Liefde zonder Onzin.pdf",
      title: "Liefde zonder Onzin",
      description: "E-book (PDF)",
      size: "1.8 MB",
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
      key: "e-books/Kärlek utan nonsens.pdf",
      title: "Kärlek utan nonsens",
      description: "E-bok (PDF)",
      size: "13.9 MB",
    },
    {
      key: "e-books/Lösningen på överanalysering.pdf",
      title: "Lösningen på överanalysering",
      description: "E-bok (PDF)",
      size: "1.3 MB",
    },
  ],
  'odpusc-ksiazka': [
    // E-book files — upload to MinIO under e-books/ folder, then update here
  ],
  'lass-los': [
    {
      key: "e-books/Die Lösung für Überdenkerinnen.docx.pdf",
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
}

// Fallback for unknown projects
const DEFAULT_EBOOK_FILES = EBOOK_FILES_BY_PROJECT.loslatenboek

// Storefront URLs per project
const STOREFRONT_URLS: Record<string, string> = {
  loslatenboek: process.env.STOREFRONT_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://tijdomloslaten.nl",
  dehondenbijbel: process.env.DH_STOREFRONT_URL || process.env.STOREFRONT_URL || "https://www.dehondenbijbel.nl",
  'slapp-taget': process.env.ST_STOREFRONT_URL || "https://www.slapptagetboken.se",
  'odpusc-ksiazka': process.env.OK_STOREFRONT_URL || "https://www.odpusc-ksiazka.pl",
  'lass-los': process.env.LL_STOREFRONT_URL || "https://www.lasslosbuch.de",
}

export default async function orderPlacedDigitalDownloadHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)
  const notificationModuleService: INotificationModuleService = container.resolve(Modules.NOTIFICATION)
  const downloadService = container.resolve(DIGITAL_DOWNLOAD_MODULE) as DigitalDownloadModuleService

  try {
    const order = await orderModuleService.retrieveOrder(data.id, {
      relations: ['items', 'shipping_address'],
    })

    // Project-specific config
    const projectConfig = getProjectEmailConfig(order)
    const projectId = projectConfig.project

    // Get e-book files for this project
    const ebookFiles = EBOOK_FILES_BY_PROJECT[projectId] || DEFAULT_EBOOK_FILES

    // Skip if no e-book files configured for this project yet
    if (!ebookFiles.length) {
      console.log(`[digital-download] No e-book files configured for project "${projectId}", skipping for order ${order.id}`)
      return
    }

    // Generate unique token
    const token = crypto.randomUUID()

    // Set expiry to 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

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

    // Get customer first name from shipping address
    const shippingAddress = await (orderModuleService as any).orderAddressService_.retrieve(
      order.shipping_address.id
    )
    const firstName = shippingAddress?.first_name || 'daar'

    // Resolve billing entity for footer
    let billingEntity: any = null
    try {
      billingEntity = await resolveBillingEntity(container, data.id)
    } catch (err: any) {
      console.warn('[digital-download] Could not resolve billing entity:', err.message)
    }

    // Send ebook delivery email (project-specific template)
    const templateKey = resolveTemplateKey(EmailTemplates.EBOOK_DELIVERY, projectConfig.project)
    const emailSubject = projectId === 'dehondenbijbel'
      ? 'Je e-book staat klaar! 📖'
      : projectId === 'slapp-taget'
        ? 'Dina e-böcker är redo! 📖'
        : projectId === 'odpusc-ksiazka'
          ? 'Twoje e-booki są gotowe! 📖'
          : projectId === 'lass-los'
            ? 'Deine E-Books sind bereit! 📖'
            : 'Je e-books staan klaar! 📖'

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

    await logEmailActivity(orderModuleService, data.id, {
      template: "ebook_delivery",
      subject: emailSubject,
      to: order.email,
      status: "sent",
      ...(htmlBody ? { html_body: htmlBody } : {}),
    }).catch((err) => console.warn('[digital-download] Could not log email activity:', err.message))

    console.log(`[digital-download] Created download token ${token} for order ${order.id}`)
  } catch (error: any) {
    console.error('[digital-download] Error creating digital download:', error)
    await logEmailActivity(orderModuleService, data.id, {
      template: "ebook_delivery",
      subject: "E-book delivery",
      to: "",
      status: "failed",
      error_message: error.message,
    }).catch(() => {})
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
