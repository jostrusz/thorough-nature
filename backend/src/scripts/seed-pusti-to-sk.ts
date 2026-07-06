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
 * Seeds the "pusti-to-sk" project — Slovak edition of "Pusť to, co tě ničí"
 * (book "Pusti to, čo ťa ničí", Joris de Vries).
 *
 * UNLIKE the Czech odpust-knizka clone, Slovakia is in the Eurozone, so this
 * script creates its OWN dedicated:
 *   - EUR region (country sk)            ← cannot reuse the CZK region
 *   - SK tax region (book reduced rate)
 *   - sales channel "pusti-to-sk" + publishable API key
 *   - dedicated stock location + fulfillment set + Packeta SK shipping options
 *   - product "Pusti to, čo ťa ničí" (handle pusti-to) with EUR pricing
 *
 * Physical fulfillment still runs through the shared Dextrum CZ warehouse via
 * Packeta SK (delivery mappings added separately in dextrum_delivery_mapping).
 *
 * Idempotent — safe to re-run.
 * Run with: pnpm medusa exec ./src/scripts/seed-pusti-to-sk.ts
 */
export default async function seedPustiToSk({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "pusti-to-sk"
  const PRODUCT_HANDLE = "pusti-to"
  const PRODUCT_SKU = "PUSTI-TO-SK-PB"
  const STOCK_LOCATION_NAME = "Pusti To SK Warehouse"
  const FULFILLMENT_SET_NAME = "Pusti To SK shipping"
  const REGION_NAME = "Slovakia (Pusti To SK)"

  // ─── 1. SALES CHANNEL ───
  logger.info("[PustiToSk] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[PustiToSk] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[PustiToSk] Created sales channel: ${salesChannel.id}`)

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
    logger.info(`[PustiToSk] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (NEW — Slovakia uses EUR, cannot reuse CZK region) ───
  logger.info("[PustiToSk] Setting up SK/EUR region...")
  const allRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  let region = allRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "sk")
  )
  if (region) {
    logger.info(`[PustiToSk] Reusing existing SK region: ${region.id} (${region.name})`)
  } else {
    // SK gateways: PayPal + Comgate (EUR) + COD. Actual per-project routing is
    // handled by the custom gateway_config layer; this just enables them on the region.
    const paymentProviderIds = [
      "pp_paypal_paypal",
      "pp_comgate_comgate",
      "pp_cod_cod",
      "pp_system_default",
    ]

    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: "eur",
            countries: ["sk"],
            payment_providers: paymentProviderIds,
            is_tax_inclusive: true,
          } as any,
        ],
      },
    })
    region = regionResult[0]
    logger.info(`[PustiToSk] Created SK region: ${region.id} (EUR, providers: ${paymentProviderIds.join(", ")})`)
  }

  // ─── 3. TAX REGION (Slovakia — reduced book VAT) ───
  logger.info("[PustiToSk] Setting up SK tax region...")
  try {
    const { data: existingTaxRegions } = await query.graph({
      entity: "tax_region",
      fields: ["id", "country_code"],
      filters: { country_code: "sk" } as any,
    })
    if (existingTaxRegions?.length) {
      logger.info(`[PustiToSk] SK tax region already exists: ${existingTaxRegions[0].id}`)
    } else {
      await createTaxRegionsWorkflow(container).run({
        input: [
          {
            country_code: "sk",
            provider_id: "tp_system",
            default_tax_rate: {
              // Slovakia moved books to the reduced 5% rate (2025). Prices are
              // tax-inclusive, so this only affects the invoice VAT breakdown.
              // VERIFY the current SK book rate before go-live.
              name: "Slovak Book VAT (5%)",
              code: "reduced-vat-sk",
              rate: 5,
            },
          } as any,
        ],
      })
      logger.info("[PustiToSk] Created SK tax region (5% book VAT)")
    }
  } catch (e: any) {
    logger.info(`[PustiToSk] Tax region step skipped: ${e.message}`)
  }

  // ─── 4. SHIPPING PROFILE (reuse default) ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 5. STOCK LOCATION (dedicated — physically the shared Dextrum CZ warehouse) ───
  logger.info("[PustiToSk] Setting up stock location...")
  let stockLocation: any
  {
    const { data: locs } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    stockLocation = locs.find((l: any) => l.name === STOCK_LOCATION_NAME)
  }
  if (stockLocation) {
    logger.info(`[PustiToSk] Reusing stock location: ${stockLocation.id}`)
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
    logger.info(`[PustiToSk] Created stock location: ${stockLocation.id}`)

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[PustiToSk] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[PustiToSk] Stock location link skipped: ${e.message}`)
  }

  // ─── 6. FULFILLMENT SET + SERVICE ZONE (SK geo zone) ───
  logger.info("[PustiToSk] Setting up fulfillment set...")
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
          name: "Slovakia (Pusti To SK)",
          geo_zones: [{ country_code: "sk", type: "country" as const }],
        },
      ],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info(`[PustiToSk] Created fulfillment set: ${fulfillmentSet.id}`)
  } else {
    logger.info(`[PustiToSk] Reusing fulfillment set: ${fulfillmentSet.id}`)
  }

  const serviceZone = fulfillmentSet.service_zones[0]

  // ─── 7. SHIPPING OPTIONS (Packeta SK — pickup 0 € / home +2 €) ───
  logger.info("[PustiToSk] Setting up shipping options...")
  const existingOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)
  const optionExists = (name: string) =>
    existingOptions.some((o: any) => o.name === name)

  const shippingOptionsToCreate: any[] = []

  if (!optionExists("Packeta - Na odberné miesto")) {
    shippingOptionsToCreate.push({
      name: "Packeta - Na odberné miesto",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: serviceZone.id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Packeta - Odberné miesto",
        description: "Vyzdvihnutie na najbližšom odbernom mieste Packeta",
        code: "packeta-pickup",
      },
      prices: [{ currency_code: "eur", amount: 0 }],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" },
        { attribute: "is_return", value: "false", operator: "eq" },
      ],
    })
  }

  if (!optionExists("Packeta - Na adresu")) {
    shippingOptionsToCreate.push({
      name: "Packeta - Na adresu",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: serviceZone.id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Packeta - Na adresu",
        description: "Doručenie kuriérom Packeta priamo na adresu",
        code: "packeta-home-delivery",
      },
      prices: [{ currency_code: "eur", amount: 2 }],
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
    logger.info(`[PustiToSk] Created ${shippingOptionsToCreate.length} shipping option(s)`)
  } else {
    logger.info(`[PustiToSk] All shipping options already exist, skipping`)
  }

  // ─── 8. PRODUCT "Pusti to, čo ťa ničí" ───
  logger.info(`[PustiToSk] Creating product 'Pusti to, čo ťa ničí'...`)
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[PustiToSk] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Pusti to, čo ťa ničí",
            description:
              "Slovenské vydanie bestselleru. Praktický sprievodca, ako sa zbaviť premýšľania v kruhoch, toxických vzťahov a minulosti, ktorá ťa ťahá dole. Autor: Joris de Vries.",
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
                prices: [{ amount: 29.9, currency_code: "eur" }],
                manage_inventory: true,
              },
            ],
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })
    product = productResult[0]
    logger.info(`[PustiToSk] Created product: ${product.id}`)
  }

  // ─── 9. INVENTORY LEVELS ───
  logger.info("[PustiToSk] Setting inventory levels...")
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
      logger.info("[PustiToSk] Inventory levels set")
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[PustiToSk] Inventory levels already exist, skipping")
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
  logger.info("[PustiToSk] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID (EUR): ${region.id}`)
  logger.info(`Stock Location ID: ${stockLocation.id}`)
  logger.info(`Fulfillment Set ID: ${fulfillmentSet.id}`)
  logger.info(`Product ID: ${product.id}`)
  logger.info(`Variant ID: ${product.variants?.[0]?.id || "<see product>"}`)
  if (apiKeyToken) {
    logger.info(`Publishable API Key: ${apiKeyToken}`)
    logger.info("⚠️  Add to storefront/src/projects/pusti-to-sk/config.json (publishableApiKey, regions.SK, mainProduct.variantId)")
  }
  logger.info("")
  logger.info("Shipping options under this service zone:")
  for (const o of finalOptions) {
    logger.info(`  - ${o.name} (${o.id})`)
  }
  logger.info("")
  logger.info("Follow-ups:")
  logger.info("  1. storefront config.json → publishableApiKey, regions.SK, variantId")
  logger.info("  2. country-order-config.ts → SK entry (sales_channel_id + shipping option IDs)")
  logger.info("  3. dextrum_delivery_mapping → map SK shipping options → Packeta delivery methods")
  logger.info("  4. gateway_config DB → add 'pusti-to-sk' to PayPal + Comgate project_slugs")
  logger.info("  5. add-bundle-to-cart.ts → BUNDLE_PRICING['pusti-to'] EUR tiers")
  logger.info("═══════════════════════════════════════════")
}
