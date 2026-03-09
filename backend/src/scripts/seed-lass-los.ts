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
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

export default async function seedLassLos({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const countries = ["de", "at", "lu"]

  // ─── 1. SALES CHANNEL ───
  logger.info("[LassLos] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Lass Los",
  })
  let salesChannel: any
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[LassLos] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: "Lass Los" }],
      },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[LassLos] Created sales channel: ${salesChannel.id}`)

    // Create a dedicated publishable API key
    const newKey = await apiKeyModuleService.createApiKeys({
      title: "Lass Los",
      type: "publishable",
      created_by: "seed-script",
    })
    await link.create({
      [Modules.API_KEY]: { publishable_key_id: newKey.id },
      [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannel.id },
    })
    logger.info(`[LassLos] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (one EUR region for DE, AT, LU) ───
  logger.info("[LassLos] Finding or creating region...")
  const regionModuleService = container.resolve(Modules.REGION)
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  let region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "de")
  )
  if (region) {
    logger.info(`[LassLos] Reusing existing region: ${region.id} (${region.name})`)
  } else {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "DACH (Lass Los)",
            currency_code: "eur",
            countries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = regionResult[0]
    logger.info(`[LassLos] Created region: ${region.id}`)
  }

  // ─── 3. TAX REGIONS (DE 7%, AT 10%, LU 3%) ───
  logger.info("[LassLos] Creating tax regions...")
  const taxConfigs = [
    {
      country_code: "de",
      provider_id: "tp_system",
      default_tax_rate: {
        rate: 7,
        code: "reduced-vat-de",
        name: "German Reduced VAT (Books)",
      },
    },
    {
      country_code: "at",
      provider_id: "tp_system",
      default_tax_rate: {
        rate: 10,
        code: "reduced-vat-at",
        name: "Austrian Reduced VAT (Books)",
      },
    },
    {
      country_code: "lu",
      provider_id: "tp_system",
      default_tax_rate: {
        rate: 3,
        code: "super-reduced-vat-lu",
        name: "Luxembourg Super-Reduced VAT (Books)",
      },
    },
  ]

  for (const taxConfig of taxConfigs) {
    try {
      await createTaxRegionsWorkflow(container).run({
        input: [taxConfig],
      })
      logger.info(`[LassLos] Created tax region for ${taxConfig.country_code.toUpperCase()} (${taxConfig.default_tax_rate.rate}%)`)
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        logger.info(`[LassLos] Tax region for ${taxConfig.country_code.toUpperCase()} already exists, skipping`)
      } else {
        throw e
      }
    }
  }

  // ─── 4. STOCK LOCATION ───
  logger.info("[LassLos] Creating stock location...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Lass Los Warehouse",
          address: {
            city: "Berlin",
            country_code: "DE",
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

  // ─── 5. FULFILLMENT (Free Shipping to DE, AT, LU) ───
  logger.info("[LassLos] Creating fulfillment...")
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

  const existingFulfillmentSets = await fulfillmentModuleService.listFulfillmentSets({
    name: "Lass Los Delivery",
  }, { relations: ["service_zones"] })
  let fulfillmentSet = existingFulfillmentSets.length ? existingFulfillmentSets[0] : null

  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Lass Los Delivery",
      type: "shipping",
      service_zones: [
        {
          name: "DACH + Luxembourg",
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
          name: "Kostenloser Versand",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Kostenloser Versand nach DE, AT & LU (3-5 Werktage)",
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
  } else {
    logger.info("[LassLos] Fulfillment set already exists, skipping")
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannel.id] },
  })

  // ─── 6. PRODUCTS ───
  logger.info("[LassLos] Creating products...")
  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Lass los, was dich kaputt macht",
          description:
            "Das Buch, das dir hilft, das Grübeln loszulassen und inneren Frieden zu finden. Autor: Joris De Vries.",
          handle: "lass-los-was-dich-kaputt-macht",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Taschenbuch"] }],
          variants: [
            {
              title: "Taschenbuch",
              sku: "LASS-LOS-TB",
              options: { Format: "Taschenbuch" },
              prices: [{ amount: 35, currency_code: "eur" }],
              manage_inventory: true,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
      ],
    },
  })

  // ─── 7. INVENTORY LEVELS ───
  logger.info("[LassLos] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: ["LASS-LOS-TB"],
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

  // ─── 8. LOG IDs ───
  logger.info("═══════════════════════════════════════════")
  logger.info("[LassLos] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info("")
  logger.info("Update storefront config with these IDs:")
  logger.info(`  "regions": { "DE": "${region.id}", "AT": "${region.id}", "LU": "${region.id}" }`)
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
