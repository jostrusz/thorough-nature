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

export default async function seedPsiSuperzivot({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const countries = ["cz"]

  // ─── 1. SALES CHANNEL ───
  logger.info("[PsiSuperzivot] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Psi Superzivot",
  })
  let salesChannel: any
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[PsiSuperzivot] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: "Psi Superzivot" }],
      },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[PsiSuperzivot] Created sales channel: ${salesChannel.id}`)

    // Create a dedicated publishable API key
    const newKey = await apiKeyModuleService.createApiKeys({
      title: "Psi Superzivot",
      type: "publishable",
      created_by: "seed-script",
    })
    await link.create({
      [Modules.API_KEY]: { publishable_key_id: newKey.id },
      [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannel.id },
    })
    logger.info(`[PsiSuperzivot] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (CZ with CZK currency) ───
  logger.info("[PsiSuperzivot] Finding or creating region...")
  const regionModuleService = container.resolve(Modules.REGION)
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  let region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "cz")
  )
  if (region) {
    logger.info(`[PsiSuperzivot] Reusing existing region: ${region.id} (${region.name})`)
  } else {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Czech Republic (Psi Superzivot)",
            currency_code: "czk",
            countries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = regionResult[0]
    logger.info(`[PsiSuperzivot] Created region: ${region.id}`)
  }

  // ─── 3. TAX REGIONS (CZ 12% reduced VAT for books) ───
  logger.info("[PsiSuperzivot] Creating tax regions...")
  try {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "cz",
          provider_id: "tp_system",
          default_tax_rate: {
            rate: 0,
            code: "zero-vat-cz",
            name: "Czech Zero VAT (Books)",
          },
        },
      ],
    })
    logger.info("[PsiSuperzivot] Created tax region for CZ (0%)")
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      logger.info("[PsiSuperzivot] Tax region for CZ already exists, skipping")
    } else {
      throw e
    }
  }

  // ─── 4. STOCK LOCATION ───
  logger.info("[PsiSuperzivot] Creating stock location...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Psi Superzivot Warehouse",
          address: {
            city: "Praha",
            country_code: "CZ",
            address_1: "Rybná 716/24",
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

  // ─── 5. FULFILLMENT (Free Shipping to CZ) ───
  logger.info("[PsiSuperzivot] Creating fulfillment...")
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
    name: "Psi Superzivot Delivery",
  }, { relations: ["service_zones"] })
  let fulfillmentSet = existingFulfillmentSets.length ? existingFulfillmentSets[0] : null

  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Psi Superzivot Delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Czech Republic",
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
          name: "Doprava zdarma",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Doprava zdarma po celé ČR (1-3 pracovní dny)",
            code: "standard",
          },
          prices: [
            { currency_code: "czk", amount: 0 },
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
    logger.info("[PsiSuperzivot] Fulfillment set already exists, skipping")
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannel.id] },
  })

  // ─── 6. PRODUCTS ───
  logger.info("[PsiSuperzivot] Creating products...")
  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Psí superživot",
          description:
            "Kompletní 4-pilířový systém pro klidného a poslušného psa. 270+ stran založených na psí psychologii. Autor: Lars Vermeulen.",
          handle: "psi-superzivot",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Formát", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback",
              sku: "PSI-SUPERZIVOT-PB",
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

  // ─── 7. INVENTORY LEVELS ───
  logger.info("[PsiSuperzivot] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: ["PSI-SUPERZIVOT-PB"],
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
  logger.info("[PsiSuperzivot] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info("")
  logger.info("Update storefront config with these IDs:")
  logger.info(`  "regions": { "CZ": "${region.id}" }`)
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
