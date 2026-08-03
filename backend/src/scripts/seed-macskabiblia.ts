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
 * Seeds "Macskabiblia" — the Hungarian edition of Kočičí bible
 * (macskabiblia-konyv.hu).
 *
 * Same shape as seed-macacia-biblia.ts (the Slovak edition): its OWN sales
 * channel + publishable key, but it reuses the HU region, warehouse and
 * Packeta shipping options already set up for "Engedd el". Medusa allows one
 * country per region, so HU cannot get a second region — linking the new
 * channel to "Engedd El Warehouse" is what exposes the existing Packeta
 * options (Csomagpont / Házhozszállítás) to its carts.
 *
 * Pricing: 7 990 Ft per book (set by the owner). Bundles follow the Czech
 * ladder 550/899/1199/1499 Kč proportionally — see BUNDLE_PRICING in
 * add-bundle-to-cart.ts, which must be kept in sync.
 *
 * Author persona is Zoltán Nagy — unlike the CZ/PL/SK editions, which all run
 * under Michal Peterka.
 *
 * Idempotent — safe to re-run.
 *
 * Run with: pnpm medusa exec ./src/scripts/seed-macskabiblia.ts
 */
export default async function seedMacskabiblia({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "Macskabiblia"
  const PRODUCT_HANDLE = "macskabiblia"
  const PRODUCT_SKU = "MACSKABIBLIA-PB"
  // Reuse the Hungarian warehouse — the Packeta shipping options hang off its
  // fulfillment set, so linking the channel here exposes them to our carts.
  const STOCK_LOCATION_NAME = "Engedd El Warehouse"
  const PRICE_HUF = 7990

  // ─── 1. SALES CHANNEL ───
  logger.info("[Macskabiblia] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[Macskabiblia] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[Macskabiblia] Created sales channel: ${salesChannel.id}`)

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
    logger.info(`[Macskabiblia] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (reuse HU region from Engedd el) ───
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  const region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "hu")
  )
  if (!region) {
    throw new Error("No region found with HU country. Run seed-engedd-el first.")
  }
  logger.info(`[Macskabiblia] Reusing region: ${region.id} (${region.name})`)

  // ─── 3. STOCK LOCATION (by NAME, not [0]!) ───
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = stockLocations.find((l: any) => l.name === STOCK_LOCATION_NAME)
  if (!stockLocation) {
    throw new Error(`Stock location "${STOCK_LOCATION_NAME}" not found.`)
  }
  logger.info(`[Macskabiblia] Using stock location: ${stockLocation.id} (${stockLocation.name})`)

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[Macskabiblia] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[Macskabiblia] Stock location link skipped: ${e.message}`)
  }

  // ─── 4. SHIPPING PROFILE (reuse default) ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 5. PRODUCT "Macskabiblia" ───
  logger.info("[Macskabiblia] Creating product 'Macskabiblia'...")
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[Macskabiblia] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Macskabiblia",
            description:
              "Teljes útmutató a boldog élethez a macskáddal. Tanuld meg a macskád titkos nyelvét, állítsd le a nem kívánt viselkedést, és építs szeretetteli kapcsolatot. 235 oldal gyakorlati tanács a macskák viselkedéstudománya alapján + 3 bónusz e-könyv: A hosszú élet a macskatálban kezdődik, A játékos macska és Macska-SOS. Szerző: Zoltán Nagy.",
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
                prices: [{ amount: PRICE_HUF, currency_code: "huf" }],
                manage_inventory: true,
              },
            ],
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })
    product = productResult[0]
    logger.info(`[Macskabiblia] Created product: ${product.id}`)
  }

  // ─── 6. INVENTORY LEVELS ───
  logger.info("[Macskabiblia] Setting inventory levels...")
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
      logger.info("[Macskabiblia] Inventory levels set")
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[Macskabiblia] Inventory levels already exist, skipping")
      } else {
        throw e
      }
    }
  }

  // ─── 7. LOG IDs ───
  logger.info("═══════════════════════════════════════════")
  logger.info("[Macskabiblia] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info(`Stock Location ID: ${stockLocation.id}`)
  logger.info(`Product ID: ${product.id}`)
  logger.info(`Variant ID: ${product.variants?.[0]?.id || "<see product>"}`)
  if (apiKeyToken) {
    logger.info(`Publishable API Key: ${apiKeyToken}`)
    logger.info("⚠️  Save this key — add it to storefront/src/projects/macskabiblia/config.json")
  }
  logger.info("═══════════════════════════════════════════")
}
