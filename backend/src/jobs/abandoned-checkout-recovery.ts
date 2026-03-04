import { MedusaContainer } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { EmailTemplates, resolveTemplateKey } from "../modules/email-notifications/templates"

/**
 * Abandoned Checkout Recovery
 *
 * Runs every 30 minutes — finds carts with:
 *   - metadata.abandoned_checkout === true
 *   - metadata.abandoned_at older than 1 hour
 *   - metadata.recovery_email_sent !== true (don't send twice)
 *   - Cart has an email address
 *   - Cart has NOT been completed (no order)
 *
 * Sends a recovery email with a link back to the checkout page.
 * The checkout page restores form data from localStorage.
 */
export default async function abandonedCheckoutRecovery(container: MedusaContainer) {
  const notificationModuleService = container.resolve(Modules.NOTIFICATION) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const logger = container.resolve("logger") as any

  try {
    // Find all carts (recent, not completed)
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
    const ONE_HOUR_MS = 60 * 60 * 1000
    let sentCount = 0
    let skippedCount = 0

    for (const cart of carts || []) {
      const meta = cart.metadata || {}

      // Skip: not an abandoned checkout cart
      if (!meta.abandoned_checkout) continue

      // Skip: already sent recovery email
      if (meta.recovery_email_sent) {
        skippedCount++
        continue
      }

      // Skip: no email on cart
      if (!cart.email) continue

      // Skip: cart was completed (has an order)
      if (cart.completed_at) continue

      // Skip: not yet 1 hour old
      const abandonedAt = new Date(meta.abandoned_at || cart.created_at)
      if ((now.getTime() - abandonedAt.getTime()) < ONE_HOUR_MS) continue

      // Skip: older than 48 hours (stale, don't bother)
      if ((now.getTime() - abandonedAt.getTime()) > 48 * ONE_HOUR_MS) continue

      // Build checkout URL
      const checkoutUrl = meta.checkout_url || "https://loslatenboek.nl/p/loslatenboek/checkout"

      // Detect project from cart metadata
      const projectId = meta.project_id || "loslatenboek"
      const projectReplyTo = projectId === "dehondenbijbel"
        ? "support@travelbible.nl"
        : "devries@loslatenboek.nl"

      // Extract customer name from shipping address
      const firstName = cart.shipping_address?.first_name || "daar"

      // Extract product info from cart items
      const mainItem = (cart.items || [])[0]
      const productName = mainItem?.variant?.product?.title || mainItem?.title
        || (projectId === "dehondenbijbel" ? "De Hondenbijbel" : "Laat Los Wat Je Kapotmaakt")
      const productPrice = mainItem?.unit_price
        ? Number(mainItem.unit_price).toFixed(2).replace(".", ",")
        : "35,00"
      const productImage = mainItem?.variant?.product?.thumbnail || ""

      // Resolve project-specific template
      const templateKey = resolveTemplateKey(EmailTemplates.ABANDONED_CHECKOUT, projectId)

      try {
        // Send recovery email
        await notificationModuleService.createNotifications({
          to: cart.email,
          channel: "email",
          template: templateKey,
          data: {
            emailOptions: {
              replyTo: projectReplyTo,
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

        // Mark as sent — update cart metadata via query
        // Use the cart module to update metadata
        const cartModuleService = container.resolve(Modules.CART) as any
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
        `[Abandoned Cart] Job completed: ${sentCount} emails sent, ${skippedCount} already sent`
      )
    }
  } catch (error: any) {
    logger.error(`[Abandoned Cart] Job failed: ${error.message}`)
  }
}

export const config = {
  name: "abandoned-checkout-recovery",
  schedule: "*/30 * * * *", // Every 30 minutes
}
