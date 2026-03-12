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

export default async function seedOdpuscKsiazka({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const countries = ["pl"]

  // ─── 1. SALES CHANNEL ───
  logger.info("[OdpuscKsiazka] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Odpusc Ksiazka",
  })
  let salesChannel: any
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[OdpuscKsiazka] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: "Odpusc Ksiazka" }],
      },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[OdpuscKsiazka] Created sales channel: ${salesChannel.id}`)

    // Create a dedicated publishable API key
    const newKey = await apiKeyModuleService.createApiKeys({
      title: "Odpusc Ksiazka",
      type: "publishable",
      created_by: "seed-script",
    })
    await link.create({
      [Modules.API_KEY]: { publishable_key_id: newKey.id },
      [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannel.id },
    })
    logger.info(`[OdpuscKsiazka] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (reuse if PL already assigned) ───
  logger.info("[OdpuscKsiazka] Finding or creating region...")
  const regionModuleService = container.resolve(Modules.REGION)
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  let region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "pl")
  )
  if (region) {
    logger.info(`[OdpuscKsiazka] Reusing existing region: ${region.id} (${region.name})`)
  } else {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Poland (Odpusc Ksiazka)",
            currency_code: "pln",
            countries,
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = regionResult[0]
    logger.info(`[OdpuscKsiazka] Created region: ${region.id}`)
  }

  // ─── 3. TAX REGION (skip if already exists) ───
  logger.info("[OdpuscKsiazka] Creating tax region...")
  try {
    await createTaxRegionsWorkflow(container).run({
      input: countries.map((country_code) => ({
        country_code,
        provider_id: "tp_system",
      })),
    })
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      logger.info("[OdpuscKsiazka] Tax region for PL already exists, skipping")
    } else {
      throw e
    }
  }

  // ─── 4. STOCK LOCATION ───
  logger.info("[OdpuscKsiazka] Creating stock location...")
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container
  ).run({
    input: {
      locations: [
        {
          name: "Odpusc Ksiazka Warehouse",
          address: {
            city: "Warsaw",
            country_code: "PL",
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
  logger.info("[OdpuscKsiazka] Creating fulfillment...")
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
    name: "Odpusc Ksiazka Delivery",
  }, { relations: ["service_zones"] })
  let fulfillmentSet = existingFulfillmentSets.length ? existingFulfillmentSets[0] : null

  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Odpusc Ksiazka Delivery",
      type: "shipping",
      service_zones: [
        {
          name: "Poland",
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
          name: "Darmowa wysyłka (InPost Paczkomat)",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Standard",
            description: "Darmowa wysyłka w Polsce — odbiór w Paczkomacie InPost",
            code: "standard",
          },
          prices: [
            { currency_code: "pln", amount: 0 },
            { region_id: region.id, amount: 0 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
        {
          name: "Dostawa do domu (Kurier)",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "Kurier",
            description: "Dostawa kurierem pod wskazany adres (3-5 dni roboczych)",
            code: "home_delivery",
          },
          prices: [
            { currency_code: "pln", amount: 500 },
            { region_id: region.id, amount: 500 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
  } else {
    logger.info("[OdpuscKsiazka] Fulfillment set already exists, skipping")
  }

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannel.id] },
  })

  // ─── 6. PRODUCTS ───
  logger.info("[OdpuscKsiazka] Creating products...")
  const { result: productResult } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Odpuść to, co cię niszczy",
          description:
            "Książka, która pomoże ci przestać się zamartwiać i znaleźć wewnętrzny spokój. Autor: Joris De Vries.",
          handle: "odpusc-to-co-cie-niszczy",
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback",
              sku: "ODPUSC-PB",
              options: { Format: "Paperback" },
              prices: [{ amount: 119, currency_code: "pln" }],
              manage_inventory: true,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
      ],
    },
  })

  // ─── 7. INVENTORY LEVELS ───
  logger.info("[OdpuscKsiazka] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: ["ODPUSC-PB"],
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
  logger.info("[OdpuscKsiazka] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info("")
  logger.info("Update storefront config.json with these IDs:")
  logger.info(`  "regions": { "PL": "${region.id}" }`)
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
