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
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Seeds the "Odpust Knizka" project (Czech edition of "Laat los wat je
 * kapotmaakt" — book "Odpusť to, co tě ničí").
 *
 * Creates its OWN sales channel + publishable API key, but reuses the CZ
 * region / tax region from "Psi Superzivot" (Medusa's 1-country-per-region
 * constraint makes region sharing canonical).
 *
 * Unlike the original kocici-bible bootstrap (which accidentally picked the
 * NL/BE stock location and needed a follow-up fulfillment seed), this script
 * creates the project's dedicated CZ warehouse + fulfillment set + Zásilkovna
 * shipping options in one pass — same end state as kocici-bible after
 * seed-kocici-bible-fulfillment.ts.
 *
 * Idempotent — safe to re-run.
 *
 * Run with: pnpm medusa exec ./src/scripts/seed-odpust-knizka.ts
 */
export default async function seedOdpustKnizka({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "Odpust Knizka"
  const PRODUCT_HANDLE = "odpust-to-co-te-nici"
  const PRODUCT_SKU = "ODPUST-TO-CO-TE-NICI-PB"
  const STOCK_LOCATION_NAME = "Odpust Knizka Warehouse"
  const FULFILLMENT_SET_NAME = "Odpust Knizka shipping"

  // ─── 1. SALES CHANNEL ───
  logger.info("[OdpustKnizka] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[OdpustKnizka] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: SALES_CHANNEL_NAME }],
      },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[OdpustKnizka] Created sales channel: ${salesChannel.id}`)

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
    logger.info(`[OdpustKnizka] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (reuse CZ region — countries can only belong to one region) ───
  logger.info("[OdpustKnizka] Finding existing CZ region...")
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  const region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "cz")
  )
  if (!region) {
    throw new Error("No region found with CZ country. Run seed-psi-superzivot first.")
  }
  logger.info(`[OdpustKnizka] Reusing region: ${region.id} (${region.name})`)

  // ─── 3. SHIPPING PROFILE (reuse default) ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found. Run seed-psi-superzivot first.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 4. STOCK LOCATION (dedicated CZ warehouse — mirrors Kocici Bible setup) ───
  logger.info("[OdpustKnizka] Setting up stock location...")
  let stockLocation: any
  {
    const { data: locs } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    stockLocation = locs.find((l: any) => l.name === STOCK_LOCATION_NAME)
  }
  if (stockLocation) {
    logger.info(`[OdpustKnizka] Reusing stock location: ${stockLocation.id}`)
  } else {
    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: STOCK_LOCATION_NAME,
            address: {
              city: "Praha",
              country_code: "CZ",
              address_1: "Rybná 716/24",
            },
          },
        ],
      },
    })
    stockLocation = stockLocationResult[0]
    logger.info(`[OdpustKnizka] Created stock location: ${stockLocation.id}`)

    // Link the location to the manual fulfillment provider
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }

  // Link sales channel to the stock location
  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[OdpustKnizka] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[OdpustKnizka] Stock location link skipped: ${e.message}`)
  }

  // ─── 5. FULFILLMENT SET + SERVICE ZONE ───
  logger.info("[OdpustKnizka] Setting up fulfillment set...")
  const existingFulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    { name: FULFILLMENT_SET_NAME },
    { relations: ["service_zones"] }
  )
  let fulfillmentSet = existingFulfillmentSets.length ? existingFulfillmentSets[0] : null

  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: FULFILLMENT_SET_NAME,
      type: "shipping",
      service_zones: [
        {
          // Service zone name must be globally unique; psi-superzivot owns
          // "Czech rep" and kocici-bible owns "Czech rep (Kocici Bible)".
          name: "Czech rep (Odpust Knizka)",
          geo_zones: [{ country_code: "cz", type: "country" as const }],
        },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info(`[OdpustKnizka] Created fulfillment set: ${fulfillmentSet.id}`)
  } else {
    logger.info(`[OdpustKnizka] Reusing fulfillment set: ${fulfillmentSet.id}`)
  }

  const serviceZone = fulfillmentSet.service_zones[0]

  // ─── 6. SHIPPING OPTIONS (Zásilkovna pickup 0 CZK / home 20 CZK) ───
  logger.info("[OdpustKnizka] Setting up shipping options...")
  const existingOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)
  const optionExists = (name: string) =>
    existingOptions.some((o: any) => o.name === name)

  const shippingOptionsToCreate: any[] = []

  if (!optionExists("Zásilkovna - Na výdejní místo")) {
    shippingOptionsToCreate.push({
      name: "Zásilkovna - Na výdejní místo",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: serviceZone.id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Zásilkovna - Výdejní místo",
        description: "Vyzvednutí na nejbližším výdejním místě Zásilkovny",
        code: "zasilkovna-pickup",
      },
      prices: [{ currency_code: "czk", amount: 0 }],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" },
        { attribute: "is_return", value: "false", operator: "eq" },
      ],
    })
  }

  if (!optionExists("Zásilkovna - Na adresu")) {
    shippingOptionsToCreate.push({
      name: "Zásilkovna - Na adresu",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: serviceZone.id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Zásilkovna - Na adresu",
        description: "Doručení kurýrem Zásilkovny přímo na adresu",
        code: "zasilkovna-home-delivery",
      },
      prices: [{ currency_code: "czk", amount: 20 }],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" },
        { attribute: "is_return", value: "false", operator: "eq" },
      ],
    })
  }

  if (shippingOptionsToCreate.length > 0) {
    await createShippingOptionsWorkflow(container).run({
      input: shippingOptionsToCreate as any,
    })
    logger.info(`[OdpustKnizka] Created ${shippingOptionsToCreate.length} shipping option(s)`)
  } else {
    logger.info(`[OdpustKnizka] All shipping options already exist, skipping`)
  }

  // ─── 7. PRODUCT "Odpusť to, co tě ničí" ───
  logger.info(`[OdpustKnizka] Creating product 'Odpusť to, co tě ničí'...`)
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[OdpustKnizka] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Odpusť to, co tě ničí",
            description:
              "České vydání bestselleru Laat los wat je kapotmaakt. Praktický průvodce, jak se zbavit přemýšlení v kruzích, toxických vztahů a minulosti, která tě táhne dolů. Autor: Joris de Vries.",
            handle: PRODUCT_HANDLE,
            weight: 450,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Formát", values: ["Paperback"] }],
            variants: [
              {
                title: "Paperback",
                sku: PRODUCT_SKU,
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
    logger.info(`[OdpustKnizka] Created product: ${product.id}`)
  }

  // ─── 8. INVENTORY LEVELS ───
  logger.info("[OdpustKnizka] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: [PRODUCT_SKU],
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
      logger.info("[OdpustKnizka] Inventory levels set")
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[OdpustKnizka] Inventory levels already exist, skipping")
      } else {
        throw e
      }
    }
  }

  // ─── 9. LOG IDs ───
  const finalOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)

  logger.info("═══════════════════════════════════════════")
  logger.info("[OdpustKnizka] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info(`Stock Location ID: ${stockLocation.id}`)
  logger.info(`Fulfillment Set ID: ${fulfillmentSet.id}`)
  logger.info(`Product ID: ${product.id}`)
  logger.info(`Variant ID: ${product.variants?.[0]?.id || "<see log>"}`)
  if (apiKeyToken) {
    logger.info(`Publishable API Key: ${apiKeyToken}`)
    logger.info("⚠️  Save this key — add it to storefront/src/projects/odpust-knizka/config.json + pages/js/project-config.js")
  }
  logger.info("")
  logger.info("Shipping options under this service zone:")
  for (const o of finalOptions) {
    logger.info(`  - ${o.name} (${o.id})`)
  }
  logger.info("")
  logger.info("Follow-ups:")
  logger.info("  1. storefront config.json + project-config.js → publishableApiKey, variantId")
  logger.info("  2. backend/src/utils/country-order-config.ts → sales_channel_id + shipping option IDs")
  logger.info("  3. gateway_config DB → add 'odpust-knizka' to Comgate/PayPal/Airwallex project_slugs")
  logger.info("═══════════════════════════════════════════")
}
