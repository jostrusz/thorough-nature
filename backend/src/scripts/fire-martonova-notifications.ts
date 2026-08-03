// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import orderPlacedHandler from "../subscribers/order-placed"
import fakturoidHandler from "../subscribers/order-placed-fakturoid"
import digitalDownloadHandler from "../subscribers/order-placed-digital-download"
import dextrumHandler from "../subscribers/order-placed-dextrum"

/**
 * One-off: run the order.placed side effects for SK2026-34310 (Jaroslava Martonová).
 *
 * `medusa exec` loads no subscribers, so the emit in create-order-martonova.ts
 * logged "order.placed which has 0 subscribers" and nothing ran — no invoice, no
 * confirmation, no e-books, no Dextrum row. This calls the four handlers directly
 * and AWAITS them, so the customer gets exactly what a normal order produces.
 *
 * Dextrum is included here (unlike the Bartková script, where it had already run).
 *
 * Run: pnpm medusa exec ./src/scripts/fire-martonova-notifications.ts
 */
export default async function fireMartonovaNotifications({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const ORDER_ID = "order_01KZ3M7VHBD2SZ9M5RRHACCDSD"

  const event = { data: { id: ORDER_ID }, name: "order.placed" }
  const args: any = { event, container, pluginOptions: {} }

  const steps: Array<[string, () => Promise<any>]> = [
    ["Fakturoid invoice", () => fakturoidHandler(args)],
    ["Order confirmation e-mail", () => orderPlacedHandler(args)],
    ["E-books delivery", () => digitalDownloadHandler(args)],
    ["Dextrum WMS row", () => dextrumHandler(args)],
  ]

  for (const [label, run] of steps) {
    try {
      logger.info(`[Martonová] → ${label} …`)
      await run()
      logger.info(`[Martonová] ✓ ${label} done`)
    } catch (e: any) {
      logger.error(`[Martonová] ✗ ${label} FAILED: ${e.message}`)
    }
  }

  // let any fire-and-forget writes settle before the process exits
  await new Promise((r) => setTimeout(r, 8000))
  logger.info("[Martonová] all steps finished")
}
