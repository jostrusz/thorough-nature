import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DIGITAL_DOWNLOAD_MODULE } from "../../../../../modules/digital-download"
import type DigitalDownloadModuleService from "../../../../../modules/digital-download/service"
import { EmailTemplates } from "../../../../../modules/email-notifications/templates"
import { resolveBillingEntity } from "../../../../../utils/resolve-billing-entity"
import { logEmailActivity } from "../../../../../utils/email-logger"
import { renderEmailToHtml } from "../../../../../utils/render-email-html"
import crypto from "crypto"

// Same ebook files as the order-placed subscriber
const EBOOK_FILES = [
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
]

const STOREFRONT_URL =
  process.env.STOREFRONT_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  "https://tijdomloslaten.nl"

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

    // Fetch order details
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
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
    const firstName = src.shipping_address?.first_name || "daar"

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
        data: { expires_at: newExpiry },
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
        files: EBOOK_FILES as any,
        expires_at: expiresAt,
        download_count: 0,
      })
    }

    const downloadUrl = `${STOREFRONT_URL}/download/${token}`

    // Resolve billing entity for email footer
    let billingEntity: any = null
    try {
      billingEntity = await resolveBillingEntity(req.scope, id)
    } catch {
      // Non-fatal
    }

    // Send ebook delivery email
    const emailSubject = "Je e-books staan klaar! \uD83D\uDCD6"
    await notificationService.createNotifications({
      to: src.email,
      channel: "email",
      template: EmailTemplates.EBOOK_DELIVERY,
      data: {
        emailOptions: {
          replyTo: "devries@loslatenboek.nl",
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
        replyTo: "devries@loslatenboek.nl",
        subject: emailSubject,
      },
      firstName,
      downloadUrl,
      expiresAt: new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000
      ).toISOString(),
      billingEntity,
    }
    const htmlBody = await renderEmailToHtml(EmailTemplates.EBOOK_DELIVERY, emailData).catch(() => '')

    const orderService = req.scope.resolve(Modules.ORDER) as any
    await logEmailActivity(orderService, id, {
      template: "ebook_delivery_resend",
      subject: emailSubject,
      to: src.email,
      status: "sent",
      ...(htmlBody ? { html_body: htmlBody } : {}),
    }).catch((err: any) => console.warn('[Resend E-books] Could not log email activity:', err.message))

    console.log(`[Resend E-books] Sent ebook email to ${src.email} for order ${id}`)

    res.json({ success: true, download_url: downloadUrl })
  } catch (error: any) {
    console.error("[Resend E-books] Error:", error)
    res.status(500).json({ error: error.message || "Failed to resend e-books" })
  }
}
