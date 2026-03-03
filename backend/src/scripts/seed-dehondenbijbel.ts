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
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function seedDehondenbijbel({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const countries = ["nl", "be"]

  // ─── 1. SALES CHANNEL (reuse if already exists) ───
  logger.info("[Dehondenbijbel] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Dehondenbijbel",
  })
  let salesChannel: any
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[Dehondenbijbel] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: "Dehondenbijbel" }],
      },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[Dehondenbijbel] Created sales channel: ${salesChannel.id}`)

    // Link to existing API key
    const apiKeys = await apiKeyModuleService.listApiKeys({ title: "Webshop" })
    if (apiKeys.length) {
      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: apiKeys[0].id, add: [salesChannel.id] },
      })
      logger.info("[Dehondenbijbel] Linked sales channel to API key")
    }
  }

  // ─── 2. REGION (reuse existing — countries can only belong to one region) ───
  logger.info("[Dehondenbijbel] Finding existing region...")
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  // Find the region that contains NL
  const region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "nl")
  )
  if (!region) {
    throw new Error("No region found with NL country. Run seed-loslatenboek first.")
  }
  logger.info(`[Dehondenbijbel] Reusing region: ${region.id} (${region.name})`)

  // ─── 3. STOCK LOCATION ───
  logger.info("[Dehondenbijbel] Creating stock location...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Dehondenbijbel Warehouse",
          address: {
            city: "Amsterdam",
            country_code: "NL",
            address_1: "",
          },
        },
      ],
    },
  })
  const stockLocation = stockLocationResult[0]

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  // ─── 4. FULFILLMENT (Free Shipping) ───
  logger.info("[Dehondenbijbel] Creating fulfillment...")
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null

  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: {
        data: [{ name: "Default Shipping Profile", type: "default" }],
      },
    })
    shippingProfile = result[0]
  }

  const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
    name: "Dehondenbijbel Delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Benelux (DH)",
        geo_zones: countries.map((c) => ({ country_code: c, type: "country" as const })),
      },
    ],
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
  })

  await createShippingOptionsWorkflow(container).run({
    input: [
      {
        name: "Gratis Verzending (GLS)",
        price_type: "flat",
        provider_id: "manual_manual",
        service_zone_id: fulfillmentSet.service_zones[0].id,
        shipping_profile_id: shippingProfile.id,
        type: {
          label: "Standard",
          description: "Gratis verzending via GLS (2-3 werkdagen)",
          code: "standard",
        },
        prices: [
          { currency_code: "eur", amount: 0 },
          { region_id: region.id, amount: 0 },
        ],
        rules: [
          { attribute: "enabled_in_store", value: "true", operator: "eq" },
          { attribute: "is_return", value: "false", operator: "eq" },
        ],
      },
    ],
  })

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannel.id] },
  })

  // ─── 5. PRODUCTS ───
  logger.info("[Dehondenbijbel] Creating products...")
  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "De Hondenbijbel",
          description:
            "Het ultieme naslagwerk voor hondenliefhebbers. Alles wat je moet weten over voeding, gezondheid, opvoeding en gedrag van je hond.",
          handle: "de-hondenbijbel",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback",
              sku: "DH8672749223",
              options: { Format: "Paperback" },
              prices: [{ amount: 35, currency_code: "eur" }],
              manage_inventory: true,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
        {
          title: "Laat Los Wat Je Kapotmaakt (DH Upsell)",
          description:
            "Het boek dat je helpt om de stortvloed aan gedachten te stoppen en innerlijke rust te vinden. Door Joris de Vries.",
          handle: "laat-los-wat-je-kapotmaakt-dh",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback",
              sku: "LOSBOEK-DH-UP",
              options: { Format: "Paperback" },
              prices: [{ amount: 35, currency_code: "eur" }],
              manage_inventory: true,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
      ],
    },
  })

  // ─── 6. INVENTORY LEVELS ───
  logger.info("[Dehondenbijbel] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: ["DH8672749223", "LOSBOEK-DH-UP"],
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

  // ─── 7. LOG IDs ───
  logger.info("═══════════════════════════════════════════")
  logger.info("[Dehondenbijbel] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info("")
  logger.info("Update storefront config.json with these IDs:")
  logger.info(`  "salesChannelId": "${salesChannel.id}"`)
  logger.info(`  "regionId": "${region.id}"`)
  logger.info(`  "regions": { "NL": "${region.id}", "BE": "${region.id}" }`)
  logger.info("")
  logger.info("Product IDs:")
  for (const product of productResult) {
    logger.info(`  ${product.title}:`)
    logger.info(`    productId: ${product.id}`)
    for (const variant of product.variants || []) {
      logger.info(`    variantId: ${variant.id} (sku: ${variant.sku})`)
    }
  }
  logger.info("═══════════════════════════════════════════")
}
