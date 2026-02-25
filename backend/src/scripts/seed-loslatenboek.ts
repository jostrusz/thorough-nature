import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function seedLoslatenboek({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const countries = ["nl", "be"]

  // ─── 1. SALES CHANNEL ───
  logger.info("[Loslatenboek] Creating sales channel...")
  const { result: salesChannelResult } = await createSalesChannelsWorkflow(
    container
  ).run({
    input: {
      salesChannelsData: [{ name: "Loslatenboek" }],
    },
  })
  const salesChannel = salesChannelResult[0]

  // ─── 2. LINK TO EXISTING API KEY ───
  const apiKeys = await apiKeyModuleService.listApiKeys({ title: "Webshop" })
  if (apiKeys.length) {
    await linkSalesChannelsToApiKeyWorkflow(container).run({
      input: { id: apiKeys[0].id, add: [salesChannel.id] },
    })
    logger.info("[Loslatenboek] Linked sales channel to API key")
  }

  // ─── 3. REGION (NL + BE) ───
  logger.info("[Loslatenboek] Creating region...")
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Benelux (Loslatenboek)",
          currency_code: "eur",
          countries,
          payment_providers: ["pp_system_default"],
        },
      ],
    },
  })
  const region = regionResult[0]

  // ─── 4. TAX REGIONS ───
  logger.info("[Loslatenboek] Creating tax regions...")
  await createTaxRegionsWorkflow(container).run({
    input: countries.map((country_code) => ({
      country_code,
      provider_id: "tp_system",
    })),
  })

  // ─── 5. STOCK LOCATION ───
  logger.info("[Loslatenboek] Creating stock location...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Loslatenboek Warehouse",
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

  // ─── 6. FULFILLMENT (Free Shipping) ───
  logger.info("[Loslatenboek] Creating fulfillment...")
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
    name: "Loslatenboek Delivery",
    type: "shipping",
    service_zones: [
      {
        name: "Benelux",
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

  // ─── 7. PRODUCTS ───
  logger.info("[Loslatenboek] Creating products...")
  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Laat Los Wat Je Kapotmaakt",
          description:
            "Het boek dat je helpt om de stortvloed aan gedachten te stoppen en innerlijke rust te vinden. Door Joris de Vries.",
          handle: "laat-los-wat-je-kapotmaakt",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback",
              sku: "LOSBOEK-PB",
              options: { Format: "Paperback" },
              prices: [{ amount: 35, currency_code: "eur" }],
              manage_inventory: true,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
        {
          title: "Het Leven Dat Je Verdient",
          description:
            "Het vervolg op Laat Los Wat Je Kapotmaakt. Ruimt je buitenwereld op.",
          handle: "het-leven-dat-je-verdient",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback",
              sku: "LEVENBOEK-PB",
              options: { Format: "Paperback" },
              prices: [{ amount: 36, currency_code: "eur" }],
              manage_inventory: true,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
      ],
    },
  })

  // ─── 8. INVENTORY LEVELS ───
  logger.info("[Loslatenboek] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: ["LOSBOEK-PB", "LEVENBOEK-PB"],
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

  // ─── 9. LOG IDs ───
  logger.info("═══════════════════════════════════════════")
  logger.info("[Loslatenboek] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info("")
  logger.info("Update storefront config.json with these IDs:")
  logger.info(`  "regions": { "NL": "${region.id}", "BE": "${region.id}" }`)
  logger.info("")
  logger.info("Product variant IDs (check admin dashboard):")
  for (const product of productResult) {
    logger.info(`  ${product.title}:`)
    for (const variant of product.variants || []) {
      logger.info(`    variant "${variant.title}": ${variant.id}`)
    }
  }
  logger.info("═══════════════════════════════════════════")
}
