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
 * Seeds the "Biblia Kotow" project — Polish edition of Kočičí bible
 * (book "Biblia kotów", biblia-kotow.pl).
 *
 * Creates its OWN sales channel + publishable API key, but reuses the
 * PL region, stock location, fulfillment set and shipping options from
 * "Odpusc Ksiazka" (1-country-per-region constraint — same pattern as
 * kocici-bible reusing psi-superzivot's CZ region). Shipping options
 * (inPost Paczkomaty / inPost - Dostawa do domu) are shared via the
 * common stock location, so no new options are created here.
 *
 * Pricing: 89 PLN per book — matches config.json and BUNDLE_PRICING
 * in add-bundle-to-cart.ts (1=89, 2=149, 3=199, 4=249).
 *
 * Idempotent — safe to re-run.
 *
 * Run with: pnpm medusa exec ./src/scripts/seed-biblia-kotow.ts
 */
export default async function seedBibliaKotow({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "Biblia Kotow"
  const PRODUCT_HANDLE = "biblia-kotow"
  const PRODUCT_SKU = "BIBLIA-KOTOW-PB"
  // Reuse Odpusc Ksiazka's PL warehouse — shipping options hang off its
  // fulfillment set, so linking the channel here exposes them to our carts.
  const STOCK_LOCATION_NAME = "Odpusc Ksiazka Warehouse"

  // ─── 1. SALES CHANNEL ───
  logger.info("[BibliaKotow] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[BibliaKotow] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[BibliaKotow] Created sales channel: ${salesChannel.id}`)

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
    logger.info(`[BibliaKotow] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (reuse PL region from Odpusc Ksiazka) ───
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  const region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "pl")
  )
  if (!region) {
    throw new Error("No region found with PL country. Run seed-odpusc-ksiazka first.")
  }
  logger.info(`[BibliaKotow] Reusing region: ${region.id} (${region.name})`)

  // ─── 3. STOCK LOCATION (reuse Odpusc Ksiazka Warehouse — by NAME, not [0]!) ───
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const stockLocation = stockLocations.find((l: any) => l.name === STOCK_LOCATION_NAME)
  if (!stockLocation) {
    throw new Error(`Stock location "${STOCK_LOCATION_NAME}" not found.`)
  }
  logger.info(`[BibliaKotow] Using stock location: ${stockLocation.id} (${stockLocation.name})`)

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[BibliaKotow] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[BibliaKotow] Stock location link skipped: ${e.message}`)
  }

  // ─── 4. SHIPPING PROFILE (reuse default) ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 5. PRODUCT "Biblia kotów" ───
  logger.info("[BibliaKotow] Creating product 'Biblia kotów'...")
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[BibliaKotow] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Biblia kotów",
            description:
              "Kompletny przewodnik po szczęśliwym życiu z kotem. Naucz się tajnego języka swojego kota, zatrzymaj niepożądane zachowania i zbuduj pełną miłości więź. 235 stron praktycznych porad opartych na kociej nauce behawioralnej + 4 bonusowe e-booki. Autor: Michał Peterka.",
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
                prices: [{ amount: 89, currency_code: "pln" }],
                manage_inventory: true,
              },
            ],
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })
    product = productResult[0]
    logger.info(`[BibliaKotow] Created product: ${product.id}`)
  }

  // ─── 6. INVENTORY LEVELS ───
  logger.info("[BibliaKotow] Setting inventory levels...")
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
      logger.info("[BibliaKotow] Inventory levels set")
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[BibliaKotow] Inventory levels already exist, skipping")
      } else {
        throw e
      }
    }
  }

  // ─── 7. LOG IDs ───
  logger.info("═══════════════════════════════════════════")
  logger.info("[BibliaKotow] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info(`Variant ID: ${product.variants?.[0]?.id || "<see product>"}`)
  if (apiKeyToken) {
    logger.info(`Publishable API Key: ${apiKeyToken}`)
    logger.info("⚠️  Save this key — add it to storefront/src/projects/biblia-kotow/config.json")
  }
  logger.info("═══════════════════════════════════════════")
}
