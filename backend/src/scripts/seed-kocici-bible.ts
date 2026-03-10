import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function seedKociciBible({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  // ─── 1. Find existing "Psi Superzivot" sales channel ───
  logger.info("[KociciBible] Finding Psi Superzivot sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Psi Superzivot",
  })
  if (!existingSalesChannels.length) {
    throw new Error("Sales channel 'Psi Superzivot' not found. Run seed-psi-superzivot first.")
  }
  const salesChannel = existingSalesChannels[0]
  logger.info(`[KociciBible] Using sales channel: ${salesChannel.id}`)

  // ─── 2. Find existing shipping profile ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found. Run seed-psi-superzivot first.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 3. Find existing stock location ───
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  if (!stockLocations.length) {
    throw new Error("No stock location found. Run seed-psi-superzivot first.")
  }
  const stockLocation = stockLocations[0]
  logger.info(`[KociciBible] Using stock location: ${stockLocation.id} (${stockLocation.name})`)

  // ─── 4. Check if product already exists ───
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id"],
    filters: { handle: "kocici-bible" },
  })
  if (existingProducts.length) {
    logger.info(`[KociciBible] Product already exists: ${existingProducts[0].id}`)
    logger.info(`[KociciBible] Variant ID: ${existingProducts[0].variants?.[0]?.id}`)
    return
  }

  // ─── 5. Create the "Kočičí bible" product ───
  logger.info("[KociciBible] Creating product...")
  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Kočičí bible",
          description:
            "Kompletní průvodce pro spokojený život s kočkou. 5 pilířů: Výživa, Psychologie, Péče, Výchova, Pouto. 220+ stran praktických rad založených na kočičí behaviorální vědě. Autor: Michal Peterka.",
          handle: "kocici-bible",
          weight: 450,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Formát", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback",
              sku: "KOCICI-BIBLE-PB",
              options: { "Formát": "Paperback" },
              prices: [{ amount: 550, currency_code: "czk" }],
              manage_inventory: true,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
      ],
    },
  })

  // ─── 6. Set inventory levels ───
  logger.info("[KociciBible] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: ["KOCICI-BIBLE-PB"],
    },
  })

  if (inventoryItems.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: inventoryItems.map((item: any) => ({
          location_id: stockLocation.id,
          stocked_quantity: 1000000,
          inventory_item_id: item.id,
        })),
      },
    })
  }

  // ─── 7. Log IDs ───
  logger.info("═══════════════════════════════════════════")
  logger.info("[KociciBible] PRODUCT CREATED!")
  for (const product of productResult) {
    logger.info(`  ${product.title}:`)
    logger.info(`    productId: ${product.id}`)
    for (const variant of product.variants || []) {
      logger.info(`    variantId: ${variant.id} (sku: ${variant.sku})`)
    }
  }
  logger.info("")
  logger.info("The storefront will auto-resolve the variant ID from handle 'kocici-bible'.")
  logger.info("═══════════════════════════════════════════")
}
