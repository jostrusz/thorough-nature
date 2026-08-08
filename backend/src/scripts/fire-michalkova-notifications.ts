// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import orderPlacedHandler from "../subscribers/order-placed"
import fakturoidHandler from "../subscribers/order-placed-fakturoid"
import digitalDownloadHandler from "../subscribers/order-placed-digital-download"
import dextrumHandler from "../subscribers/order-placed-dextrum"

/**
 * One-off: run the order.placed side effects for CZ2026-35297 (Zdenka Michálková).
 *
 * `medusa exec` loads no subscribers, so create-order-michalkova.ts vytvořilo
 * objednávku, ale nic se neodeslalo — žádná faktura, potvrzení ani řádek
 * v Dextrumu. Tohle volá čtyři handlery přímo a AWAITuje je, takže zákaznice
 * dostane přesně to, co produkuje běžná objednávka.
 *
 * Run: pnpm medusa exec ./src/scripts/fire-michalkova-notifications.ts
 */
export default async function fireMichalkovaNotifications({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const ORDER_ID = "order_01KZAPTQRM2KYRBRN7EFQKH08A"

  const event = { data: { id: ORDER_ID }, name: "order.placed" }
  const args: any = { event, container, pluginOptions: {} }

  const steps: Array<[string, () => Promise<any>]> = [
    ["Fakturoid faktura", () => fakturoidHandler(args)],
    ["Potvrzení objednávky", () => orderPlacedHandler(args)],
    ["E-booky", () => digitalDownloadHandler(args)],
    ["Dextrum WMS", () => dextrumHandler(args)],
  ]

  for (const [label, run] of steps) {
    try {
      logger.info(`[Michálková] → ${label} …`)
      await run()
      logger.info(`[Michálková] ✓ ${label} hotovo`)
    } catch (e: any) {
      logger.error(`[Michálková] ✗ ${label} SELHALO: ${e.message}`)
    }
  }

  // nechat doběhnout fire-and-forget zápisy
  await new Promise((r) => setTimeout(r, 8000))
  logger.info("[Michálková] všechny kroky dokončeny")
}
