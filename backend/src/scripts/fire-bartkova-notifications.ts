// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import orderPlacedHandler from "../subscribers/order-placed"
import fakturoidHandler from "../subscribers/order-placed-fakturoid"
import digitalDownloadHandler from "../subscribers/order-placed-digital-download"

/**
 * One-off: run the order.placed side effects for SK2026-27799 (Katarína Bartková).
 *
 * The creation script emitted order.placed but exited before the async
 * subscribers finished — only Dextrum made it through. This calls the three
 * remaining handlers directly and AWAITS them, so the customer gets exactly what
 * a normal paid order produces: invoice, order confirmation, e-books.
 *
 * Run: pnpm medusa exec ./src/scripts/fire-bartkova-notifications.ts
 */
export default async function fireBartkovaNotifications({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const ORDER_ID = "order_01KXR1G2APVSKGJ861W3PPG7CE"

  const event = { data: { id: ORDER_ID }, name: "order.placed" }
  const args: any = { event, container, pluginOptions: {} }

  const steps: Array<[string, () => Promise<any>]> = [
    ["Fakturoid invoice", () => fakturoidHandler(args)],
    ["Order confirmation e-mail", () => orderPlacedHandler(args)],
    ["E-books delivery", () => digitalDownloadHandler(args)],
  ]

  for (const [label, run] of steps) {
    try {
      logger.info(`[Bartkova] → ${label} …`)
      await run()
      logger.info(`[Bartkova] ✓ ${label} done`)
    } catch (e: any) {
      logger.error(`[Bartkova] ✗ ${label} FAILED: ${e.message}`)
    }
  }

  // let any fire-and-forget writes settle before the process exits
  await new Promise((r) => setTimeout(r, 8000))
  logger.info("[Bartkova] all steps finished")
}
