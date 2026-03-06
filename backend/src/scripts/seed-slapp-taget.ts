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

export default async function seedSlappTaget({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const countries = ["se"]

  // ─── 1. SALES CHANNEL ───
  logger.info("[SlappTaget] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Slapp Taget",
  })
  let salesChannel: any
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[SlappTaget] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: "Slapp Taget" }],
      },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[SlappTaget] Created sales channel: ${salesChannel.id}`)

    // Create a dedicated publishable API key
    const newKey = await apiKeyModuleService.createApiKeys({
      title: "Slapp Taget",
      type: "publishable",
      created_by: "seed-script",
    })
    await link.create({
      [Modules.API_KEY]: { publishable_key_id: newKey.id },
      [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannel.id },
    })
    logger.info(`[SlappTaget] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (reuse if SE already assigned) ───
  logger.info("[SlappTaget] Finding or creating region...")
  const regionModuleService = container.resolve(Modules.REGION)
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  let region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "se")
  )
  if (region) {
    logger.info(`[SlappTaget] Reusing existing region: ${region.id} (${region.name})`)
  } else {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Sweden (Slapp Taget)",
            currency_code: "sek",
            countries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = regionResult[0]
    logger.info(`[SlappTaget] Created region: ${region.id}`)
  }

  // ─── 3. TAX REGION (skip if already exists) ───
  logger.info("[SlappTaget] Creating tax region...")
  try {
    await createTaxRegionsWorkflow(container).run({
      input: countries.map((country_code) => ({
        country_code,
        provider_id: "tp_system",
      })),
    })
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      logger.info("[SlappTaget] Tax region for SE already exists, skipping")
    } else {
      throw e
    }
  }

  // ─── 4. STOCK LOCATION ───
  logger.info("[SlappTaget] Creating stock location...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Slapp Taget Warehouse",
          address: {
            city: "Stockholm",
            country_code: "SE",
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

  // ─── 5. FULFILLMENT (Free Shipping) ───
  logger.info("[SlappTaget] Creating fulfillment...")
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
    name: "Slapp Taget Delivery",
  }, { relations: ["service_zones"] })
  let fulfillmentSet = existingFulfillmentSets.length ? existingFulfillmentSets[0] : null

  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Slapp Taget Delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Sweden",
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
          name: "Fri frakt (PostNord)",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Fri frakt via PostNord (3-5 arbetsdagar)",
            code: "standard",
          },
          prices: [
            { currency_code: "sek", amount: 0 },
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
    logger.info("[SlappTaget] Fulfillment set already exists, skipping")
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannel.id] },
  })

  // ─── 6. PRODUCTS ───
  logger.info("[SlappTaget] Creating products...")
  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Släpp taget om det som förstör dig",
          description:
            "Boken som hjälper dig att stoppa det ständiga grubblandet och hitta inre lugn. Av Joris De Vries.",
          handle: "slapp-taget-om-det-som-forstor-dig",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Pocket"] }],
          variants: [
            {
              title: "Pocket",
              sku: "SLAPP-PB",
              options: { Format: "Pocket" },
              prices: [{ amount: 399, currency_code: "sek" }],
              manage_inventory: true,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
      ],
    },
  })

  // ─── 7. INVENTORY LEVELS ───
  logger.info("[SlappTaget] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: ["SLAPP-PB"],
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
  logger.info("[SlappTaget] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info("")
  logger.info("Update storefront config.json with these IDs:")
  logger.info(`  "regions": { "SE": "${region.id}" }`)
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
