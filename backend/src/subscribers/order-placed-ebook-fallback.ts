import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'

/**
 * Fallback e-book delivery on order.placed
 *
 * Some payment providers (like Klarna) only authorize at checkout — they don't
 * emit payment.captured until the merchant captures manually. This subscriber
 * waits 15 seconds after order.placed and then sends e-books if they haven't
 * been sent yet by the payment.captured subscriber.
 *
 * The ebook_sent flag in order metadata prevents duplicate sends.
 */
export default async function orderPlacedEbookFallbackHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  // Wait 15 seconds — give payment.captured subscriber a chance to run first
  await new Promise(resolve => setTimeout(resolve, 15000))

  // Dynamically import the send function from the main subscriber
  // We use a direct DB check to see if ebooks were already sent
  try {
    const { Pool } = require("pg")
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const result = await pool.query(
      `SELECT metadata->>'ebook_sent' as ebook_sent FROM "order" WHERE id = $1`,
      [data.id]
    )
    await pool.end()

    if (result.rows[0]?.ebook_sent === 'true') {
      console.log(`[digital-download-fallback] E-books already sent for order ${data.id}, skipping`)
      return
    }
  } catch (err: any) {
    console.warn(`[digital-download-fallback] Could not check ebook_sent flag: ${err.message}`)
    // Continue anyway — the main handler has its own duplicate guard
  }

  // Import and call the shared send function
  try {
    const { Modules } = await import('@medusajs/framework/utils')
    const { IOrderModuleService } = await import('@medusajs/framework/types')
    const orderModuleService = container.resolve(Modules.ORDER)
    const { INotificationModuleService } = await import('@medusajs/framework/types')
    const notificationModuleService = container.resolve(Modules.NOTIFICATION)
    const { DIGITAL_DOWNLOAD_MODULE } = await import('../modules/digital-download')
    const downloadService = container.resolve(DIGITAL_DOWNLOAD_MODULE)
    const { getProjectEmailConfig } = await import('../utils/project-email-config')
    const { EmailTemplates, resolveTemplateKey } = await import('../modules/email-notifications/templates')
    const { resolveBillingEntity } = await import('../utils/resolve-billing-entity')
    const { logEmailActivity } = await import('../utils/email-logger')
    const { renderEmailToHtml } = await import('../utils/render-email-html')
    const crypto = await import('crypto')

    const order = await (orderModuleService as any).retrieveOrder(data.id, {
      relations: ['items', 'shipping_address'],
    })

    // Double-check ebook_sent flag on the order object
    if (order.metadata?.ebook_sent) {
      console.log(`[digital-download-fallback] E-books already sent for order ${order.id}, skipping`)
      return
    }

    const projectConfig = getProjectEmailConfig(order)
    const projectId = projectConfig.project

    // E-book files per project
    const EBOOK_FILES_BY_PROJECT: Record<string, Array<{ key: string; title: string; description: string; size: string }>> = {
      loslatenboek: [
        { key: "e-books/De Overthinking Oplossing.pdf", title: "De Overthinking Oplossing", description: "E-book (PDF)", size: "2.4 MB" },
        { key: "e-books/Liefde zonder Onzin.pdf", title: "Liefde zonder Onzin", description: "E-book (PDF)", size: "1.8 MB" },
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

    const STOREFRONT_URLS: Record<string, string> = {
      loslatenboek: process.env.STOREFRONT_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://tijdomloslaten.nl",
      dehondenbijbel: process.env.DH_STOREFRONT_URL || process.env.STOREFRONT_URL || "https://www.dehondenbijbel.nl",
      'slapp-taget': process.env.ST_STOREFRONT_URL || "https://www.slapptagetboken.se",
      'odpusc-ksiazka': process.env.OK_STOREFRONT_URL || "https://www.odpusc-ksiazka.pl",
      'lass-los': process.env.LL_STOREFRONT_URL || "https://www.lasslosbuch.de",
    }

    const EMAIL_SUBJECTS: Record<string, string> = {
      loslatenboek: 'Je e-books staan klaar! 📖',
      dehondenbijbel: 'Je e-book staat klaar! 📖',
      'slapp-taget': 'Dina e-böcker är redo! 📖',
      'odpusc-ksiazka': 'Twoje e-booki są gotowe! 📖',
      'lass-los': 'Deine E-Books sind bereit! 📖',
    }

    const DEFAULT_FIRST_NAMES: Record<string, string> = {
      loslatenboek: 'daar', dehondenbijbel: 'daar', 'slapp-taget': 'där', 'odpusc-ksiazka': 'tam', 'lass-los': 'dort',
    }

    const ebookFiles = EBOOK_FILES_BY_PROJECT[projectId] || EBOOK_FILES_BY_PROJECT.loslatenboek
    if (!ebookFiles.length) {
      console.log(`[digital-download-fallback] No e-book files for project "${projectId}", skipping`)
      return
    }

    const token = crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    await (downloadService as any).createDigitalDownloads({
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

    let firstName = DEFAULT_FIRST_NAMES[projectId] || 'daar'
    try {
      if (order.shipping_address?.id) {
        const addr = await (orderModuleService as any).orderAddressService_.retrieve(order.shipping_address.id)
        if (addr?.first_name) firstName = addr.first_name
      }
    } catch {}

    let billingEntity: any = null
    try { billingEntity = await resolveBillingEntity(container, data.id) } catch {}

    const templateKey = resolveTemplateKey(EmailTemplates.EBOOK_DELIVERY, projectId)
    const emailSubject = EMAIL_SUBJECTS[projectId] || EMAIL_SUBJECTS.loslatenboek

    await (notificationModuleService as any).createNotifications({
      to: order.email,
      channel: 'email',
      template: templateKey,
      ...(projectConfig.fromEmail ? { from: projectConfig.fromEmail } : {}),
      data: {
        emailOptions: { replyTo: projectConfig.replyTo, subject: emailSubject },
        firstName,
        downloadUrl,
        expiresAt: expiresAt.toISOString(),
        billingEntity,
      },
    })

    const htmlBody = await renderEmailToHtml(templateKey, {
      emailOptions: { replyTo: projectConfig.replyTo, subject: emailSubject },
      firstName, downloadUrl, expiresAt: expiresAt.toISOString(), billingEntity,
    }).catch(() => '')

    await logEmailActivity(orderModuleService as any, data.id, {
      template: "ebook_delivery",
      subject: emailSubject,
      to: order.email,
      status: "sent",
      ...(htmlBody ? { html_body: htmlBody } : {}),
    }).catch(() => {})

    // Mark as sent
    try {
      const { Pool: P } = require("pg")
      const p = new P({ connectionString: process.env.DATABASE_URL, max: 2 })
      await p.query(
        `UPDATE "order" SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{ebook_sent}', 'true'), updated_at = NOW() WHERE id = $1`,
        [order.id]
      )
      await p.end()
    } catch {}

    console.log(`[digital-download-fallback] Sent e-books for order ${order.id} (project: ${projectId}, trigger: order.placed fallback)`)
  } catch (error: any) {
    console.error(`[digital-download-fallback] Error:`, error)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
