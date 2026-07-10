// @ts-nocheck
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
 * Seeds the "Zivot Zaslugy" project — Czech edition of the LIFE RESET™ book
 * "Het Leven Dat Je Verdient" (book "Život, který si zasloužíš", Anna de Vries).
 * Czech sibling of the Polish clone zycie-zaslugy (najpierw-ja.pl).
 *
 * Domain: nejdriv-ja.cz
 *
 * Mirrors seed-odpust-knizka.ts: creates its OWN sales channel + publishable
 * API key + dedicated CZ warehouse + Zásilkovna shipping options, but reuses
 * the shared CZ (CZK) region + tax region (Medusa's 1-country-per-region
 * constraint makes region sharing canonical).
 *
 * Unlike odpust-knizka the product ships with 4 bundle variants (ZKZ-1..4)
 * matching the het-leven / zycie-zaslugy tier structure.
 *
 * Physical fulfillment runs through the shared Dextrum CZ warehouse via
 * Zásilkovna (delivery mappings added separately in dextrum_delivery_mapping).
 *
 * Idempotent — safe to re-run.
 * Run with: pnpm medusa exec ./src/scripts/seed-zivot-zaslugy.ts
 */
export default async function seedZivotZaslugy({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "Zivot Zaslugy"
  const PRODUCT_HANDLE = "zivot-ktery-si-zasluzis"
  const STOCK_LOCATION_NAME = "Zivot Zaslugy Warehouse"
  const FULFILLMENT_SET_NAME = "Zivot Zaslugy shipping"

  // Bundle tiers — mirrors het-leven (36/59/79/99 €) & zycie-zaslugy
  // (129/199/279/359 zł), priced like the odpust-knizka CZ ladder.
  const VARIANTS = [
    { title: "1 kniha",  sku: "ZKZ-1", qty: 1, amount: 749 },
    { title: "2 knihy",  sku: "ZKZ-2", qty: 2, amount: 1149 },
    { title: "3 knihy",  sku: "ZKZ-3", qty: 3, amount: 1599 },
    { title: "4 knihy",  sku: "ZKZ-4", qty: 4, amount: 1999 },
  ]

  // ─── 1. SALES CHANNEL ───
  logger.info("[ZivotZaslugy] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[ZivotZaslugy] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: SALES_CHANNEL_NAME }],
      },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[ZivotZaslugy] Created sales channel: ${salesChannel.id}`)

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
    logger.info(`[ZivotZaslugy] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (reuse shared CZ region) ───
  logger.info("[ZivotZaslugy] Finding existing CZ region...")
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  const region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "cz")
  )
  if (!region) {
    throw new Error("No region found with CZ country. Run seed-psi-superzivot first.")
  }
  logger.info(`[ZivotZaslugy] Reusing region: ${region.id} (${region.name})`)

  // ─── 3. SHIPPING PROFILE (reuse default) ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found. Run seed-psi-superzivot first.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 4. STOCK LOCATION (dedicated CZ warehouse) ───
  logger.info("[ZivotZaslugy] Setting up stock location...")
  let stockLocation: any
  {
    const { data: locs } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    stockLocation = locs.find((l: any) => l.name === STOCK_LOCATION_NAME)
  }
  if (stockLocation) {
    logger.info(`[ZivotZaslugy] Reusing stock location: ${stockLocation.id}`)
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
    logger.info(`[ZivotZaslugy] Created stock location: ${stockLocation.id}`)

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[ZivotZaslugy] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[ZivotZaslugy] Stock location link skipped: ${e.message}`)
  }

  // ─── 5. FULFILLMENT SET + SERVICE ZONE ───
  logger.info("[ZivotZaslugy] Setting up fulfillment set...")
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
          // Service zone name must be globally unique across projects.
          name: "Czech rep (Zivot Zaslugy)",
          geo_zones: [{ country_code: "cz", type: "country" as const }],
        },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info(`[ZivotZaslugy] Created fulfillment set: ${fulfillmentSet.id}`)
  } else {
    logger.info(`[ZivotZaslugy] Reusing fulfillment set: ${fulfillmentSet.id}`)
  }

  const serviceZone = fulfillmentSet.service_zones[0]

  // ─── 6. SHIPPING OPTIONS (Zásilkovna pickup 0 CZK / home 20 CZK — mirrors odpust-knizka) ───
  logger.info("[ZivotZaslugy] Setting up shipping options...")
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
    logger.info(`[ZivotZaslugy] Created ${shippingOptionsToCreate.length} shipping option(s)`)
  } else {
    logger.info(`[ZivotZaslugy] All shipping options already exist, skipping`)
  }

  // ─── 7. PRODUCT "Život, který si zasloužíš" (4 bundle variants) ───
  logger.info(`[ZivotZaslugy] Creating product 'Život, který si zasloužíš'...`)
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[ZivotZaslugy] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Život, který si zasloužíš",
            description:
              "České vydání bestselleru Het Leven Dat Je Verdient. Metoda LIFE RESET™ — 5 pilířů, které krok za krokem promění tvoje věci, domov, vztahy, hlavu a energii. Autorka: Anna de Vries. 340 stran + pracovní sešity.",
            handle: PRODUCT_HANDLE,
            weight: 520,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Balení", values: VARIANTS.map((v) => v.title) }],
            variants: VARIANTS.map((v) => ({
              title: v.title,
              sku: v.sku,
              options: { "Balení": v.title },
              prices: [{ amount: v.amount, currency_code: "czk" }],
              manage_inventory: true,
            })),
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })
    product = productResult[0]
    logger.info(`[ZivotZaslugy] Created product: ${product.id}`)
  }

  // ─── 8. INVENTORY LEVELS ───
  logger.info("[ZivotZaslugy] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: {
      sku: VARIANTS.map((v) => v.sku),
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
      logger.info("[ZivotZaslugy] Inventory levels set")
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[ZivotZaslugy] Inventory levels already exist, skipping")
      } else {
        throw e
      }
    }
  }

  // ─── 9. LOG IDs ───
  const finalOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)
  const { data: finalProduct } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.sku", "variants.title"],
    filters: { handle: PRODUCT_HANDLE },
  })

  logger.info("═══════════════════════════════════════════")
  logger.info("[ZivotZaslugy] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info(`Stock Location ID: ${stockLocation.id}`)
  logger.info(`Fulfillment Set ID: ${fulfillmentSet.id}`)
  logger.info(`Product ID: ${finalProduct[0]?.id}`)
  for (const v of finalProduct[0]?.variants || []) {
    logger.info(`  Variant ${v.sku}: ${v.id} (${v.title})`)
  }
  if (apiKeyToken) {
    logger.info(`Publishable API Key: ${apiKeyToken}`)
    logger.info("⚠️  Save this key — add it to storefront/src/projects/zivot-zaslugy/config.json")
  }
  logger.info("")
  logger.info("Shipping options under this service zone:")
  for (const o of finalOptions) {
    logger.info(`  - ${o.name} (${o.id})`)
  }
  logger.info("")
  logger.info("Follow-ups:")
  logger.info("  1. storefront config.json → publishableApiKey, region, variant IDs")
  logger.info("  2. backend/src/utils/country-order-config.ts → sales_channel_id + shipping option IDs")
  logger.info("  3. gateway_config DB → add 'zivot-zaslugy' to Comgate/PayPal project_slugs")
  logger.info("  4. project_config DB row + PROJECT_DOMAIN_MAP (nejdriv-ja.cz)")
  logger.info("═══════════════════════════════════════════")
}
