import { MedusaContainer } from "@medusajs/framework/types"
import { Modules, ContainerRegistrationKeys } from "@medusajs/framework/utils"

/**
 * Klarna Authorization Expiration Check
 *
 * Runs daily at 6:00 AM — checks for Klarna orders with authorized
 * but uncaptured payments approaching the 28-day expiration deadline.
 *
 * Actions:
 * - 25+ days old: Logs warning in payment_activity_log
 * - 28+ days old: Marks as expired in metadata
 */
export default async function klarnaAuthorizationCheck(container: MedusaContainer) {
  const orderModuleService = container.resolve(Modules.ORDER) as any
  const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
  const logger = container.resolve("logger") as any

  try {
    // Find orders with klarnaOrderId that are not yet captured and not expired
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "metadata",
        "total",
        "currency_code",
        "created_at",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters: {},
      pagination: { order: { created_at: "DESC" }, skip: 0, take: 200 },
    })

    const now = new Date()
    const WARN_DAYS = 25
    const EXPIRE_DAYS = 28

    let warnCount = 0
    let expireCount = 0

    for (const order of orders || []) {
      const meta = order.metadata || {}

      // Skip orders without Klarna
      if (!meta.klarnaOrderId) continue

      // Skip already captured, expired, cancelled, or refunded orders
      if (meta.payment_captured || meta.klarna_expired || meta.klarna_cancelled || meta.klarna_refunded) continue

      // Find the Klarna payment to get the authorization date
      const payments = (order.payment_collections || []).flatMap(
        (pc: any) => pc.payments || []
      )
      const klarnaPayment = payments.find(
        (p: any) => p.provider_id?.includes("klarna") || p.data?.klarnaOrderId
      )

      if (!klarnaPayment) continue

      // Calculate age from payment creation or order creation
      const authDate = new Date(klarnaPayment.created_at || order.created_at)
      const ageDays = Math.floor((now.getTime() - authDate.getTime()) / (1000 * 60 * 60 * 24))

      if (ageDays >= EXPIRE_DAYS) {
        // Mark as expired
        const existingLog = meta.payment_activity_log || []
        await orderModuleService.updateOrders(order.id, {
          metadata: {
            ...meta,
            klarna_expired: true,
            klarna_expired_at: now.toISOString(),
            payment_activity_log: [
              ...existingLog,
              {
                timestamp: now.toISOString(),
                event: "authorization_expired",
                gateway: "klarna",
                payment_method: "klarna",
                status: "failed",
                amount: order.total || 0,
                currency: order.currency_code,
                detail: `Klarna authorization expired after ${ageDays} days (28-day limit). Order #${order.display_id}`,
              },
            ],
          },
        })
        expireCount++
        logger.warn(
          `[Klarna Auth Check] Order #${order.display_id} (${order.id}): Authorization EXPIRED after ${ageDays} days`
        )
      } else if (ageDays >= WARN_DAYS) {
        // Check if we already warned about this order
        const existingLog = meta.payment_activity_log || []
        const alreadyWarned = existingLog.some(
          (entry: any) => entry.event === "authorization_expiring_soon"
        )

        if (!alreadyWarned) {
          const daysLeft = EXPIRE_DAYS - ageDays
          await orderModuleService.updateOrders(order.id, {
            metadata: {
              ...meta,
              klarna_expiration_warning: true,
              klarna_expiration_warning_at: now.toISOString(),
              payment_activity_log: [
                ...existingLog,
                {
                  timestamp: now.toISOString(),
                  event: "authorization_expiring_soon",
                  gateway: "klarna",
                  payment_method: "klarna",
                  status: "warning",
                  amount: order.total || 0,
                  currency: order.currency_code,
                  detail: `Klarna authorization expires in ${daysLeft} days! Capture payment before expiration. Order #${order.display_id}`,
                },
              ],
            },
          })
          warnCount++
          logger.warn(
            `[Klarna Auth Check] Order #${order.display_id} (${order.id}): Authorization expires in ${daysLeft} days — CAPTURE NOW`
          )
        }
      }
    }

    if (warnCount > 0 || expireCount > 0) {
      logger.info(
        `[Klarna Auth Check] Completed: ${warnCount} warnings, ${expireCount} expirations`
      )
    }
  } catch (error: any) {
    logger.error(`[Klarna Auth Check] Job failed: ${error.message}`)
  }
}

export const config = {
  name: "klarna-authorization-check",
  schedule: "0 6 * * *", // Daily at 6:00 AM
}
