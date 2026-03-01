import { Modules } from '@medusajs/framework/utils'
import { INotificationModuleService, IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { EmailTemplates } from '../modules/email-notifications/templates'
import { DIGITAL_DOWNLOAD_MODULE } from '../modules/digital-download'
import type DigitalDownloadModuleService from '../modules/digital-download/service'
import { resolveBillingEntity } from './utils/resolve-billing-entity'
import crypto from 'crypto'

// Hardcoded ebook files for Loslatenboek — these are the MinIO keys
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

// Base URL for the download page on the storefront
const STOREFRONT_URL = process.env.STOREFRONT_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://tijdomloslaten.nl"

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

    // For now: always create download for every order (single product store)
    // Later: check item metadata or product_type for digital products

    // Generate unique token
    const token = crypto.randomUUID()

    // Set expiry to 7 days from now
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    // Create digital download record
    await downloadService.createDigitalDownloads({
      order_id: order.id,
      token,
      email: order.email,
      files: EBOOK_FILES as any,
      expires_at: expiresAt,
      download_count: 0,
    })

    const downloadUrl = `${STOREFRONT_URL}/download/${token}`

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

    // Send ebook delivery email
    await notificationModuleService.createNotifications({
      to: order.email,
      channel: 'email',
      template: EmailTemplates.EBOOK_DELIVERY,
      data: {
        emailOptions: {
          replyTo: 'devries@loslatenboek.nl',
          subject: 'Je e-books staan klaar! 📖',
        },
        firstName,
        downloadUrl,
        expiresAt: expiresAt.toISOString(),
        billingEntity,
      },
    })

    console.log(`[digital-download] Created download token ${token} for order ${order.id}`)
  } catch (error) {
    console.error('[digital-download] Error creating digital download:', error)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
