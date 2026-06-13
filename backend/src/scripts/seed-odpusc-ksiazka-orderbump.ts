import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * Creates the order-bump (upsell) product for the odpusc-ksiazka checkout:
 * a dedicated copy of "Życie, jakiego nigdy sobie nie pozwoliłaś" placed in the
 * "Odpusc Ksiazka" sales channel so it can be added to that project's cart.
 *
 * Mirrors the zycie-zaslugy pattern (dedicated suffixed-handle bump product).
 * Run against prod DB via: railway run -- pnpm medusa exec ./src/scripts/seed-odpusc-ksiazka-orderbump.ts
 */
export default async function seedOdpuscKsiazkaOrderBump({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)

  const HANDLE = "zycie-jakiego-nigdy-sobie-nie-pozwolilas-odpusc-ksiazka"
  const THUMBNAIL =
    "https://bucket-production-b93e.up.railway.app:443/medusa-media/Zycie-jakiego-nigdy-sobie-nie-pozwolilas-pichi-01KQV9FJE4MMTVEDQ4TSG7AGG9.png"

  // ─── Resolve Odpusc Ksiazka sales channel ───
  const channels = await salesChannelModuleService.listSalesChannels({
    name: "Odpusc Ksiazka",
  })
  if (!channels.length) {
    throw new Error("[OrderBump] Sales channel 'Odpusc Ksiazka' not found")
  }
  const salesChannel = channels[0]
  logger.info(`[OrderBump] Sales channel: ${salesChannel.id}`)

  // ─── Default shipping profile ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("[OrderBump] No default shipping profile found")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── Create the upsell product ───
  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Życie, jakiego nigdy sobie nie pozwoliłaś – Upsell",
          subtitle: "Order bump (odpusc-ksiazka)",
          description:
            "Wersja order-bump książki „Życie, jakiego nigdy sobie nie pozwoliłaś” (Anna de Vries) — dodawana jednym kliknięciem przy zamówieniu książki „Odpuść to, co cię niszczy”.",
          handle: HANDLE,
          thumbnail: THUMBNAIL,
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback",
              sku: "ZJN-1-1",
              options: { Format: "Paperback" },
              prices: [{ amount: 129, currency_code: "pln" }],
              // Order-bump add-on — never block on stock
              manage_inventory: false,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
      ],
    },
  })

  const product = result[0]
  logger.info("═══════════════════════════════════════════")
  logger.info("[OrderBump] CREATED upsell product")
  logger.info(`  productId: ${product.id}`)
  logger.info(`  handle:    ${product.handle}`)
  for (const v of product.variants || []) {
    logger.info(`  variantId: ${v.id}  (sku: ${v.sku})`)
  }
  logger.info("═══════════════════════════════════════════")
}
