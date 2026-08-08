// @ts-nocheck
import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

import orderPlacedHandler from "../subscribers/order-placed"
import digitalDownloadHandler from "../subscribers/order-placed-digital-download"
import dextrumHandler from "../subscribers/order-placed-dextrum"

/**
 * One-off: order.placed side effects pro CZ2026-36043 (Městská knihovna Velká Bíteš).
 *
 * ⚠️ fakturoidHandler ZDE SCHVÁLNĚ CHYBÍ. Faktura 2026-40338 je vystavená ručně
 * se splatností 14 dní a stavem "open". Kdyby se pustil subscriber, vystavil by
 * druhou fakturu a rovnou ji označil jako zaplacenou — což u faktury splatné
 * až po dodání nedává smysl a rozbilo by to účetnictví.
 *
 * Run: pnpm medusa exec ./src/scripts/fire-knihovna-bites-notifications.ts
 */
export default async function fireKnihovnaBitesNotifications({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const ORDER_ID = "order_01KZFA4NAKF11N1WB3RZHPQTVA"

  const event = { data: { id: ORDER_ID }, name: "order.placed" }
  const args: any = { event, container, pluginOptions: {} }

  const steps: Array<[string, () => Promise<any>]> = [
    ["Potvrzení objednávky", () => orderPlacedHandler(args)],
    ["E-booky", () => digitalDownloadHandler(args)],
    ["Dextrum WMS", () => dextrumHandler(args)],
  ]

  for (const [label, run] of steps) {
    try {
      logger.info(`[Knihovna Bíteš] → ${label} …`)
      await run()
      logger.info(`[Knihovna Bíteš] ✓ ${label} hotovo`)
    } catch (e: any) {
      logger.error(`[Knihovna Bíteš] ✗ ${label} SELHALO: ${e.message}`)
    }
  }

  await new Promise((r) => setTimeout(r, 8000))
  logger.info("[Knihovna Bíteš] hotovo (Fakturoid úmyslně přeskočen)")
}
