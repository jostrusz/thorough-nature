import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Seeds the "Kocici Bible" project.
 *
 * Creates its OWN sales channel + publishable API key, but reuses CZ region,
 * tax region, stock location and fulfillment set from "Psi Superzivot"
 * (Medusa's 1-country-per-region constraint makes region sharing canonical —
 * same pattern as dehondenbijbel reusing loslatenboek's NL region).
 *
 * Also creates a new product "Kočičí bible Oficial" (handle: kocici-bible-oficial).
 * Linked to the new sales channel.
 *
 * Run with: pnpm medusa exec ./src/scripts/seed-kocici-bible.ts
 */
export default async function seedKociciBible({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  // ─── 1. SALES CHANNEL ───
  logger.info("[KociciBible] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Kocici Bible",
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[KociciBible] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: "Kocici Bible" }],
      },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[KociciBible] Created sales channel: ${salesChannel.id}`)

    const newKey = await apiKeyModuleService.createApiKeys({
      title: "Kocici Bible",
      type: "publishable",
      created_by: "seed-script",
    })
    await link.create({
      [Modules.API_KEY]: { publishable_key_id: newKey.id },
      [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannel.id },
    })
    apiKeyToken = newKey.token
    logger.info(`[KociciBible] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (reuse CZ region — countries can only belong to one region) ───
  logger.info("[KociciBible] Finding existing CZ region...")
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  const region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "cz")
  )
  if (!region) {
    throw new Error("No region found with CZ country. Run seed-psi-superzivot first.")
  }
  logger.info(`[KociciBible] Reusing region: ${region.id} (${region.name})`)

  // ─── 3. STOCK LOCATION (reuse existing CZ warehouse) ───
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  if (!stockLocations.length) {
    throw new Error("No stock location found. Run seed-psi-superzivot first.")
  }
  const stockLocation = stockLocations[0]
  logger.info(`[KociciBible] Using stock location: ${stockLocation.id} (${stockLocation.name})`)

  // Link new sales channel to the existing stock location
  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[KociciBible] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[KociciBible] Stock location link skipped: ${e.message}`)
  }

  // ─── 4. SHIPPING PROFILE (reuse default) ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found. Run seed-psi-superzivot first.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 5. PRODUCT "Kočičí bible Oficial" ───
  logger.info("[KociciBible] Creating product 'Kočičí bible Oficial'...")
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: "kocici-bible-oficial" },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[KociciBible] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Kočičí bible Oficial",
            description:
              "Kompletní průvodce pro spokojený život s kočkou. 5 pilířů: Výživa, Psychologie, Péče, Výchova, Pouto. 220+ stran praktických rad založených na kočičí behaviorální vědě. Autor: Michal Peterka.",
            handle: "kocici-bible-oficial",
            weight: 450,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Formát", values: ["Paperback"] }],
            variants: [
              {
                title: "Paperback",
                sku: "KOCICI-BIBLE-OFICIAL-PB",
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
    product = productResult[0]
    logger.info(`[KociciBible] Created product: ${product.id}`)
  }

  // ─── 6. INVENTORY LEVELS ───
  logger.info("[KociciBible] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: ["KOCICI-BIBLE-OFICIAL-PB"],
    },
  })

  if (inventoryItems.length) {
    try {
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: inventoryItems.map((item: any) => ({
            location_id: stockLocation.id,
            stocked_quantity: 1000000,
            inventory_item_id: item.id,
          })),
        },
      })
      logger.info("[KociciBible] Inventory levels set")
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[KociciBible] Inventory levels already exist, skipping")
      } else {
        throw e
      }
    }
  }

  // ─── 7. LOG IDs ───
  logger.info("═══════════════════════════════════════════")
  logger.info("[KociciBible] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  if (apiKeyToken) {
    logger.info(`Publishable API Key: ${apiKeyToken}`)
    logger.info("⚠️  Save this key — add it to storefront/src/projects/kocici-bible/config.json")
  }
  logger.info("")
  logger.info("Update storefront/src/projects/kocici-bible/config.json with:")
  logger.info(`  "regions": { "CZ": "${region.id}" }`)
  logger.info(`  "mainProduct": { ..., "variantId": "${product.variants?.[0]?.id || '<see log>'}", ... }`)
  if (apiKeyToken) {
    logger.info(`  "publishableApiKey": "${apiKeyToken}"`)
  }
  logger.info("═══════════════════════════════════════════")
}
