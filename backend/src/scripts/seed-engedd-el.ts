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
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Seeds the "Engedd el" project (Hungarian edition of "Laat los wat je
 * kapotmaakt" — book "Engedd el, ami tönkretesz").
 *
 * FIRST HUF-currency project in the system — unlike odpust-knizka (which
 * reused the existing CZK region), this creates a brand-new region + tax
 * region from scratch. Fulfillment ships from the SAME Dextrum CZ warehouse
 * (Rybná 716/24, Praha) as odpust-knizka/psi-superzivot — cross-border to HU
 * via Zásilkovna/Packeta, same pattern as Austria shipping cross-border from
 * the lass-los DE/AT/LU warehouse.
 *
 * PLACEHOLDERS requiring confirmation before go-live:
 *   - Product price (11990 HUF) and shipping price (990 HUF) are proportional
 *     estimates from the CZK pricing, NOT confirmed HU market pricing.
 *   - No payment provider wired yet (gateway_config untouched) — checkout
 *     will have no way to pay until a gateway is chosen and configured.
 *
 * Idempotent — safe to re-run.
 *
 * Run with: pnpm medusa exec ./src/scripts/seed-engedd-el.ts
 */
export default async function seedEngeddEl({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "Engedd el"
  const PRODUCT_HANDLE = "engedd-el-ami-tonkretesz"
  const PRODUCT_SKU = "ENGEDD-EL-PB"
  const STOCK_LOCATION_NAME = "Engedd El Warehouse"
  const FULFILLMENT_SET_NAME = "Engedd El shipping"

  // ─── 1. SALES CHANNEL ───
  logger.info("[EngeddEl] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[EngeddEl] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: {
        salesChannelsData: [{ name: SALES_CHANNEL_NAME }],
      },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[EngeddEl] Created sales channel: ${salesChannel.id}`)

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
    logger.info(`[EngeddEl] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (brand-new — HUF has no existing region) ───
  logger.info("[EngeddEl] Finding or creating HU region...")
  const existingRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  let region = existingRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "hu")
  )
  if (region) {
    logger.info(`[EngeddEl] Reusing existing region: ${region.id} (${region.name})`)
  } else {
    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: "Hungary (Engedd El)",
            currency_code: "huf",
            countries: ["hu"],
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = regionResult[0]
    logger.info(`[EngeddEl] Created region: ${region.id}`)
  }

  // ─── 3. TAX REGION (HU 5% reduced VAT on books) ───
  logger.info("[EngeddEl] Creating tax region...")
  try {
    await createTaxRegionsWorkflow(container).run({
      input: [
        {
          country_code: "hu",
          provider_id: "tp_system",
          default_tax_rate: {
            rate: 5,
            code: "reduced-vat-hu",
            name: "Hungarian Reduced VAT (Books)",
          },
        },
      ],
    })
    logger.info("[EngeddEl] Created tax region for HU (5%)")
  } catch (e: any) {
    if (e.message?.includes("already exists")) {
      logger.info("[EngeddEl] Tax region for HU already exists, skipping")
    } else {
      throw e
    }
  }

  // ─── 4. SHIPPING PROFILE (reuse default) ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 5. STOCK LOCATION (same physical Dextrum CZ warehouse as odpust-knizka) ───
  logger.info("[EngeddEl] Setting up stock location...")
  let stockLocation: any
  {
    const { data: locs } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    stockLocation = locs.find((l: any) => l.name === STOCK_LOCATION_NAME)
  }
  if (stockLocation) {
    logger.info(`[EngeddEl] Reusing stock location: ${stockLocation.id}`)
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
    logger.info(`[EngeddEl] Created stock location: ${stockLocation.id}`)

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[EngeddEl] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[EngeddEl] Stock location link skipped: ${e.message}`)
  }

  // ─── 6. FULFILLMENT SET + SERVICE ZONE (country_code: hu) ───
  logger.info("[EngeddEl] Setting up fulfillment set...")
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
          name: "Hungary (Engedd El)",
          geo_zones: [{ country_code: "hu", type: "country" as const }],
        },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info(`[EngeddEl] Created fulfillment set: ${fulfillmentSet.id}`)
  } else {
    logger.info(`[EngeddEl] Reusing fulfillment set: ${fulfillmentSet.id}`)
  }

  const serviceZone = fulfillmentSet.service_zones[0]

  // ─── 7. SHIPPING OPTIONS (Zásilkovna pickup 0 HUF / home 990 HUF — PLACEHOLDER) ───
  logger.info("[EngeddEl] Setting up shipping options...")
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
        description: "Csomagpont átvétel (Zásilkovna / Packeta)",
        code: "zasilkovna-pickup",
      },
      prices: [{ currency_code: "huf", amount: 0 }],
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
        description: "Házhozszállítás (Zásilkovna / Packeta futár)",
        code: "zasilkovna-home-delivery",
      },
      prices: [{ currency_code: "huf", amount: 990 }],
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
    logger.info(`[EngeddEl] Created ${shippingOptionsToCreate.length} shipping option(s)`)
  } else {
    logger.info(`[EngeddEl] All shipping options already exist, skipping`)
  }

  // ─── 8. PRODUCT "Engedd el, ami tönkretesz" ───
  logger.info(`[EngeddEl] Creating product 'Engedd el, ami tönkretesz'...`)
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[EngeddEl] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Engedd el, ami tönkretesz",
            description:
              "A nemzetközi bestseller (Laat los wat je kapotmaakt) magyar kiadása. Gyakorlati útmutató, hogyan szabadulj meg a körkörös aggodalmaskodástól, a mérgező kapcsolatoktól és a múlttól, ami visszahúz. Szerző: Joris de Vries.",
            handle: PRODUCT_HANDLE,
            weight: 450,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Formátum", values: ["Puhakötés"] }],
            variants: [
              {
                title: "Puhakötés",
                sku: PRODUCT_SKU,
                options: { "Formátum": "Puhakötés" },
                // PLACEHOLDER price — proportional estimate from CZK pricing,
                // NOT confirmed HU market pricing. Confirm before go-live.
                prices: [{ amount: 11990, currency_code: "huf" }],
                manage_inventory: true,
              },
            ],
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })
    product = productResult[0]
    logger.info(`[EngeddEl] Created product: ${product.id}`)
  }

  // ─── 9. INVENTORY LEVELS ───
  logger.info("[EngeddEl] Setting inventory levels...")
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
      logger.info("[EngeddEl] Inventory levels set")
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[EngeddEl] Inventory levels already exist, skipping")
      } else {
        throw e
      }
    }
  }

  // ─── 10. LOG IDs ───
  const finalOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)

  logger.info("═══════════════════════════════════════════")
  logger.info("[EngeddEl] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID: ${region.id}`)
  logger.info(`Stock Location ID: ${stockLocation.id}`)
  logger.info(`Fulfillment Set ID: ${fulfillmentSet.id}`)
  logger.info(`Product ID: ${product.id}`)
  logger.info(`Variant ID: ${product.variants?.[0]?.id || "<see log>"}`)
  if (apiKeyToken) {
    logger.info(`Publishable API Key: ${apiKeyToken}`)
    logger.info("⚠️  Save this key — add it to storefront/src/projects/engedd-el/config.json + pages/js/project-config.js")
  }
  logger.info("")
  logger.info("Shipping options under this service zone:")
  for (const o of finalOptions) {
    logger.info(`  - ${o.name} (${o.id})`)
  }
  logger.info("")
  logger.info("Follow-ups:")
  logger.info("  1. storefront config.json + project-config.js → publishableApiKey, variantId")
  logger.info("  2. backend/src/utils/country-order-config.ts → REGION_IDS.huf + sales_channel_id + shipping option IDs")
  logger.info("  3. dextrum_delivery_mapping → map both shipping options to existing U0123_ZAS_ADRESA / U0123_ZAS_VYD")
  logger.info("  4. gateway_config DB → NOT SET (payment provider TBD per user)")
  logger.info("  5. Confirm/replace PLACEHOLDER pricing (11990/990 HUF) with real numbers")
  logger.info("═══════════════════════════════════════════")
}
