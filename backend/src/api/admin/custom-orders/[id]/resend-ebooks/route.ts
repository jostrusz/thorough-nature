import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DIGITAL_DOWNLOAD_MODULE } from "../../../../../modules/digital-download"
import type DigitalDownloadModuleService from "../../../../../modules/digital-download/service"
import { EmailTemplates, resolveTemplateKey } from "../../../../../modules/email-notifications/templates"
import { resolveBillingEntity } from "../../../../../utils/resolve-billing-entity"
import { logEmailActivity } from "../../../../../utils/email-logger"
import { renderEmailToHtml } from "../../../../../utils/render-email-html"
import { getProjectEmailConfig } from "../../../../../utils/project-email-config"
import crypto from "crypto"

// Ebook files per project — must match order-placed-digital-download.ts
const EBOOK_FILES_BY_PROJECT: Record<string, Array<{ key: string; title: string; description: string; size: string }>> = {
  loslatenboek: [
    { key: "e-books/De Overthinking Oplossing.pdf", title: "De Overthinking Oplossing", description: "E-book (PDF)", size: "1.3 MB" },
    { key: "e-books/Liefde zonder Onzin.pdf", title: "Liefde zonder Onzin", description: "E-book (PDF)", size: "13.8 MB" },
  ],
  dehondenbijbel: [
    { key: "e-books/Langlevendheid begint in de voerbak.pdf", title: "Langlevendheid begint in de voerbak", description: "E-book (PDF)", size: "3.7 MB" },
    { key: "e-books/TOP 20 spelletjes.pdf", title: "TOP 20 spelletjes", description: "E-book (PDF)", size: "798 KB" },
    { key: "e-books/Waroom Doet Hij Dat.pdf", title: "Waroom Doet Hij Dat", description: "E-book (PDF)", size: "4.0 MB" },
  ],
  'slapp-taget': [
    { key: "e-books/Kärlek utan nonsens.pdf", title: "Kärlek utan nonsens", description: "E-bok (PDF)", size: "13.9 MB" },
    { key: "e-books/Lösningen på överanalysering.pdf", title: "Lösningen på överanalysering", description: "E-bok (PDF)", size: "1.3 MB" },
  ],
  'odpusc-ksiazka': [],
  'lass-los': [
    { key: "e-books/Die Lösung für Überdenkerinnen.docx.pdf", title: "Die Lösung für Überdenkerinnen", description: "E-Book (PDF)", size: "1.4 MB" },
    { key: "e-books/LIEBE OHNE UNSINN.pdf", title: "Liebe ohne Unsinn", description: "E-Book (PDF)", size: "14.3 MB" },
  ],
}

const DEFAULT_EBOOK_FILES = EBOOK_FILES_BY_PROJECT.loslatenboek

// Storefront URLs per project
const STOREFRONT_URLS: Record<string, string> = {
  loslatenboek: process.env.LLWJK_STOREFRONT_URL || "https://storefront-production-fccf.up.railway.app",
  dehondenbijbel: process.env.DH_STOREFRONT_URL || process.env.STOREFRONT_URL || "https://www.dehondenbijbel.nl",
  'slapp-taget': process.env.ST_STOREFRONT_URL || "https://www.slapptagetboken.se",
  'odpusc-ksiazka': process.env.OK_STOREFRONT_URL || "https://www.odpusc-ksiazka.pl",
  'lass-los': process.env.LL_STOREFRONT_URL || "https://www.lasslosbuch.de",
}

// Localized email subjects per project
const EMAIL_SUBJECTS: Record<string, string> = {
  loslatenboek: 'Je e-books staan klaar! 📖',
  dehondenbijbel: 'Je e-book staat klaar! 📖',
  'slapp-taget': 'Dina e-böcker är redo! 📖',
  'odpusc-ksiazka': 'Twoje e-booki są gotowe! 📖',
  'lass-los': 'Deine E-Books sind bereit! 📖',
}

// Localized fallback first name per project
const DEFAULT_FIRST_NAMES: Record<string, string> = {
  loslatenboek: 'daar',
  dehondenbijbel: 'daar',
  'slapp-taget': 'där',
  'odpusc-ksiazka': 'tam',
  'lass-los': 'dort',
}

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const notificationService = req.scope.resolve(Modules.NOTIFICATION) as any
    const downloadService = req.scope.resolve(
      DIGITAL_DOWNLOAD_MODULE
    ) as DigitalDownloadModuleService

    // Fetch order details including metadata for project_id
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
        "metadata",
        "shipping_address.first_name",
        "payment_collections.payments.provider_id",
      ],
      filters: { id },
    })

    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    const src = order as any

    // Resolve project from order metadata
    const projectConfig = getProjectEmailConfig(src)
    const projectId = projectConfig.project

    // Get project-specific ebook files
    const ebookFiles = EBOOK_FILES_BY_PROJECT[projectId] || DEFAULT_EBOOK_FILES

    if (!ebookFiles.length) {
      res.status(400).json({ error: `No e-book files configured for project "${projectId}"` })
      return
    }

    const firstName = src.shipping_address?.first_name || DEFAULT_FIRST_NAMES[projectId] || "daar"
    const storefrontUrl = STOREFRONT_URLS[projectId] || STOREFRONT_URLS.loslatenboek

    // Find existing download record for this order
    let token: string
    const existing = await downloadService.listDigitalDownloads({
      order_id: id,
    })

    if (existing && existing.length > 0) {
      // Reuse existing token, extend expiry by 7 days
      token = (existing[0] as any).token
      const newExpiry = new Date()
      newExpiry.setDate(newExpiry.getDate() + 7)
      await downloadService.updateDigitalDownloads({
        selector: { id: (existing[0] as any).id },
        data: {
          expires_at: newExpiry,
          files: ebookFiles as any, // Update files in case they changed
          metadata: { project_id: projectId },
        },
      })
    } else {
      // Create new download record
      token = crypto.randomUUID()
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)
      await downloadService.createDigitalDownloads({
        order_id: id,
        token,
        email: src.email,
        files: ebookFiles as any,
        expires_at: expiresAt,
        download_count: 0,
        metadata: { project_id: projectId },
      })
    }

    const downloadUrl = `${storefrontUrl}/download/${token}`

    // Resolve billing entity for email footer
    let billingEntity: any = null
    try {
      billingEntity = await resolveBillingEntity(req.scope, id)
    } catch {
      // Non-fatal
    }

    // Send project-specific ebook delivery email
    const templateKey = resolveTemplateKey(EmailTemplates.EBOOK_DELIVERY, projectId)
    const emailSubject = EMAIL_SUBJECTS[projectId] || EMAIL_SUBJECTS.loslatenboek

    await notificationService.createNotifications({
      to: src.email,
      channel: "email",
      template: templateKey,
      ...(projectConfig.fromEmail ? { from: projectConfig.fromEmail } : {}),
      data: {
        emailOptions: {
          replyTo: projectConfig.replyTo,
          subject: emailSubject,
        },
        firstName,
        downloadUrl,
        expiresAt: new Date(
          Date.now() + 7 * 24 * 60 * 60 * 1000
        ).toISOString(),
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
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      billingEntity,
    }
    const htmlBody = await renderEmailToHtml(templateKey, emailData).catch(() => '')

    const orderService = req.scope.resolve(Modules.ORDER) as any
    await logEmailActivity(orderService, id, {
      template: "ebook_delivery_resend",
      subject: emailSubject,
      to: src.email,
      status: "sent",
      ...(htmlBody ? { html_body: htmlBody } : {}),
    }).catch((err: any) => console.warn('[Resend E-books] Could not log email activity:', err.message))

    console.log(`[Resend E-books] Sent ${projectId} ebook email to ${src.email} for order ${id}`)

    res.json({ success: true, download_url: downloadUrl, project: projectId })
  } catch (error: any) {
    console.error("[Resend E-books] Error:", error)
    res.status(500).json({ error: error.message || "Failed to resend e-books" })
  }
}
