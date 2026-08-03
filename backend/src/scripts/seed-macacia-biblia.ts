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
 * Seeds "Mačacia biblia" — the Slovak edition of Kočičí bible
 * (macaciabiblia.sk).
 *
 * Same shape as seed-biblia-kotow.ts (the Polish edition of the same book):
 * its OWN sales channel + publishable key, but it reuses the SK region,
 * warehouse and Packeta shipping options already set up for "Pusti To SK".
 * Medusa allows one country per region, so SK cannot get a second region —
 * linking the new channel to "Pusti To SK Warehouse" is what exposes the
 * existing Packeta options (Na odberné miesto / Na adresu) to its carts.
 *
 * Pricing: 22 € per book, converted from the Czech 550 Kč at the July ECB
 * average (24.2073 CZK/EUR → 22.72 €) and rounded down to a round number.
 * Bundles follow the Czech ladder proportionally — see BUNDLE_PRICING in
 * add-bundle-to-cart.ts, which must be kept in sync.
 *
 * Idempotent — safe to re-run.
 *
 * Run with: pnpm medusa exec ./src/scripts/seed-macacia-biblia.ts
 */
export default async function seedMacaciaBiblia({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "Macacia Biblia"
  const PRODUCT_HANDLE = "macacia-biblia"
  const PRODUCT_SKU = "MACACIA-BIBLIA-PB"
  // Reuse the Slovak warehouse — the Packeta shipping options hang off its
  // fulfillment set, so linking the channel here exposes them to our carts.
  const STOCK_LOCATION_NAME = "Pusti To SK Warehouse"
  const PRICE_EUR = 22

  // ─── 1. SALES CHANNEL ───
  logger.info("[MacaciaBiblia] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[MacaciaBiblia] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[MacaciaBiblia] Created sales channel: ${salesChannel.id}`)

    const newKey = await apiKeyModuleService.createApiKeys({
      title: SALES_CHANNEL_NAME,
      type: "publishable",
      created_by: "seed-script",
    })
    await link.create({
      [Modules.API_KEY]: { publishable_key_id: newKey.id },
      [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannel.id },
    })
    apiKeyToken = newKey.token
    logger.info(`[MacaciaBiblia] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (reuse SK region from Pusti To SK) ───
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  const region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "sk")
  )
  if (!region) {
    throw new Error("No region found with SK country. Run seed-pusti-to-sk first.")
  }
  logger.info(`[MacaciaBiblia] Reusing region: ${region.id} (${region.name})`)

  // ─── 3. STOCK LOCATION (by NAME, not [0]!) ───
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = stockLocations.find((l: any) => l.name === STOCK_LOCATION_NAME)
  if (!stockLocation) {
    throw new Error(`Stock location "${STOCK_LOCATION_NAME}" not found.`)
  }
  logger.info(`[MacaciaBiblia] Using stock location: ${stockLocation.id} (${stockLocation.name})`)

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[MacaciaBiblia] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[MacaciaBiblia] Stock location link skipped: ${e.message}`)
  }

  // ─── 4. SHIPPING PROFILE (reuse default) ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 5. PRODUCT "Mačacia biblia" ───
  logger.info("[MacaciaBiblia] Creating product 'Mačacia biblia'...")
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[MacaciaBiblia] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Mačacia biblia",
            description:
              "Kompletný sprievodca šťastným životom s mačkou. Nauč sa tajnú reč svojej mačky, zastav nežiaduce správanie a vybuduj vzťah plný lásky. 235 strán praktických rád založených na mačacej behaviorálnej vede + 4 bonusové e-knihy. Autor: Michal Peterka.",
            handle: PRODUCT_HANDLE,
            weight: 450,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Format", values: ["Paperback"] }],
            variants: [
              {
                title: "Paperback",
                sku: PRODUCT_SKU,
                options: { Format: "Paperback" },
                prices: [{ amount: PRICE_EUR, currency_code: "eur" }],
                manage_inventory: true,
              },
            ],
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })
    product = productResult[0]
    logger.info(`[MacaciaBiblia] Created product: ${product.id}`)
  }

  // ─── 6. INVENTORY LEVELS ───
  logger.info("[MacaciaBiblia] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: { sku: [PRODUCT_SKU] },
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
      logger.info("[MacaciaBiblia] Inventory levels set")
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[MacaciaBiblia] Inventory levels already exist, skipping")
      } else {
        throw e
      }
    }
  }

  // ─── 7. LOG IDs ───
  logger.info("═══════════════════════════════════════════")
  logger.info("[MacaciaBiblia] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info(`Stock Location ID: ${stockLocation.id}`)
  logger.info(`Product ID: ${product.id}`)
  logger.info(`Variant ID: ${product.variants?.[0]?.id || "<see product>"}`)
  if (apiKeyToken) {
    logger.info(`Publishable API Key: ${apiKeyToken}`)
    logger.info("⚠️  Save this key — add it to storefront/src/projects/macacia-biblia/config.json")
  }
  logger.info("═══════════════════════════════════════════")
}
