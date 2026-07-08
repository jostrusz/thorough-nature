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
 * Seeds the "lache-livre" project — French edition of the book
 * "Lâche prise sur ce qui te détruit" (Joris de Vries), cloned from the Dutch
 * loslatenboek. France uses EUR; this creates its OWN dedicated:
 *   - EUR region (country fr)                ← dedicated, isolated from the shared Europe region
 *   - sales channel "lache-livre" + publishable API key
 *   - dedicated stock location (physically the shared Dextrum CZ warehouse)
 *   - Packeta FR shipping options (point relais 0 € / à domicile 0 €)
 *   - product "Lâche prise sur ce qui te détruit" (handle lache-prise) with
 *     4 per-bundle variants (like loslatenboek): SKU LACHE-1..4 → 36/61/82/102 €
 *
 * FR tax region already exists (shared) — reused. Physical fulfillment runs
 * through the shared Dextrum CZ warehouse via Packeta FR (delivery mappings +
 * country-order-config entry added separately).
 *
 * Idempotent — safe to re-run.
 * Run with: pnpm medusa exec ./src/scripts/seed-lache-livre.ts
 */
export default async function seedLacheLivre({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "lache-livre"
  const PRODUCT_HANDLE = "lache-prise"
  const STOCK_LOCATION_NAME = "Lache Livre FR Warehouse"
  const FULFILLMENT_SET_NAME = "Lache Livre FR shipping"
  const REGION_NAME = "France (Lache Livre)"

  // Per-bundle variants (like loslatenboek). SKU encodes the bundle qty; the
  // server-side add-bundle-to-cart workflow resolves the price via BUNDLE_PRICING.
  const BUNDLE_VARIANTS = [
    { qty: 1, sku: "LACHE-1", price: 36, label: "1 livre" },
    { qty: 2, sku: "LACHE-2", price: 61, label: "2 livres" },
    { qty: 3, sku: "LACHE-3", price: 82, label: "3 livres" },
    { qty: 4, sku: "LACHE-4", price: 102, label: "4 livres" },
  ]

  // ─── 1. SALES CHANNEL ───
  logger.info("[LacheLivre] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[LacheLivre] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[LacheLivre] Created sales channel: ${salesChannel.id}`)

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
    logger.info(`[LacheLivre] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (NEW — dedicated France EUR region) ───
  logger.info("[LacheLivre] Setting up FR/EUR region...")
  const allRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  let region = allRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "fr")
  )
  if (region) {
    logger.info(`[LacheLivre] Reusing existing FR region: ${region.id} (${region.name})`)
  } else {
    // FR gateways routed by the custom gateway_config layer: Airwallex (card) +
    // PayPal + Klarna. Mirror the Europe region's provider set for flexibility.
    const paymentProviderIds = [
      "pp_airwallex_airwallex",
      "pp_paypal_paypal",
      "pp_klarna_klarna",
      "pp_mollie_mollie",
      "pp_stripe_stripe",
      "pp_system_default",
    ]

    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: "eur",
            countries: ["fr"],
            payment_providers: paymentProviderIds,
            is_tax_inclusive: true,
          } as any,
        ],
      },
    })
    region = regionResult[0]
    logger.info(`[LacheLivre] Created FR region: ${region.id} (EUR, providers: ${paymentProviderIds.join(", ")})`)
  }

  // ─── 3. TAX REGION (France — reduced book VAT 5.5%) ───
  logger.info("[LacheLivre] Setting up FR tax region...")
  try {
    const { data: existingTaxRegions } = await query.graph({
      entity: "tax_region",
      fields: ["id", "country_code"],
      filters: { country_code: "fr" } as any,
    })
    if (existingTaxRegions?.length) {
      logger.info(`[LacheLivre] FR tax region already exists: ${existingTaxRegions[0].id} (verify 5.5% book rate)`)
    } else {
      await createTaxRegionsWorkflow(container).run({
        input: [
          {
            country_code: "fr",
            provider_id: "tp_system",
            default_tax_rate: {
              // France applies a reduced 5.5% VAT to printed books. Prices are
              // tax-inclusive, so this only affects the invoice VAT breakdown.
              name: "French Book VAT (5.5%)",
              code: "reduced-vat-fr",
              rate: 5.5,
            },
          } as any,
        ],
      })
      logger.info("[LacheLivre] Created FR tax region (5.5% book VAT)")
    }
  } catch (e: any) {
    logger.info(`[LacheLivre] Tax region step skipped: ${e.message}`)
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
  logger.info("[LacheLivre] Setting up stock location...")
  let stockLocation: any
  {
    const { data: locs } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    stockLocation = locs.find((l: any) => l.name === STOCK_LOCATION_NAME)
  }
  if (stockLocation) {
    logger.info(`[LacheLivre] Reusing stock location: ${stockLocation.id}`)
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
    logger.info(`[LacheLivre] Created stock location: ${stockLocation.id}`)

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[LacheLivre] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[LacheLivre] Stock location link skipped: ${e.message}`)
  }

  // ─── 6. FULFILLMENT SET + SERVICE ZONE (FR geo zone) ───
  logger.info("[LacheLivre] Setting up fulfillment set...")
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
          name: "France (Lache Livre)",
          geo_zones: [{ country_code: "fr", type: "country" as const }],
        },
      ],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info(`[LacheLivre] Created fulfillment set: ${fulfillmentSet.id}`)
  } else {
    logger.info(`[LacheLivre] Reusing fulfillment set: ${fulfillmentSet.id}`)
  }

  const serviceZone = fulfillmentSet.service_zones[0]

  // ─── 7. SHIPPING OPTIONS (Packeta FR — point relais 0 € / à domicile 0 €, livraison gratuite) ───
  logger.info("[LacheLivre] Setting up shipping options...")
  const existingOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)
  const optionExists = (name: string) =>
    existingOptions.some((o: any) => o.name === name)

  const shippingOptionsToCreate: any[] = []

  if (!optionExists("Packeta - Point relais")) {
    shippingOptionsToCreate.push({
      name: "Packeta - Point relais",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: serviceZone.id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Packeta - Point relais",
        description: "Retrait dans le point relais Packeta le plus proche",
        code: "packeta-pickup",
      },
      prices: [{ currency_code: "eur", amount: 0 }],
      rules: [
        { attribute: "enabled_in_store", value: "true", operator: "eq" },
        { attribute: "is_return", value: "false", operator: "eq" },
      ],
    })
  }

  if (!optionExists("Packeta - À domicile")) {
    shippingOptionsToCreate.push({
      name: "Packeta - À domicile",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: serviceZone.id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Packeta - À domicile",
        description: "Livraison par le transporteur Packeta directement à votre adresse",
        code: "packeta-home-delivery",
      },
      prices: [{ currency_code: "eur", amount: 0 }],
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
    logger.info(`[LacheLivre] Created ${shippingOptionsToCreate.length} shipping option(s)`)
  } else {
    logger.info(`[LacheLivre] All shipping options already exist, skipping`)
  }

  // ─── 8. PRODUCT "Lâche prise sur ce qui te détruit" (4 per-bundle variants) ───
  logger.info(`[LacheLivre] Creating product 'Lâche prise sur ce qui te détruit'...`)
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[LacheLivre] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Lâche prise sur ce qui te détruit",
            subtitle: "Commence à vivre une vie authentique",
            description:
              "Édition française du best-seller. Un guide pratique pour arrêter de ruminer en boucle, te libérer de la culpabilité, des relations toxiques et du passé qui te tire vers le bas. Auteur : Joris de Vries.",
            handle: PRODUCT_HANDLE,
            weight: 450,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [
              { title: "Pack", values: BUNDLE_VARIANTS.map((b) => b.label) },
            ],
            variants: BUNDLE_VARIANTS.map((b) => ({
              title: b.label,
              sku: b.sku,
              options: { Pack: b.label },
              prices: [{ amount: b.price, currency_code: "eur" }],
              manage_inventory: true,
            })),
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })
    product = productResult[0]
    logger.info(`[LacheLivre] Created product: ${product.id} with ${product.variants?.length || 0} variants`)
  }

  // ─── 9. INVENTORY LEVELS (all 4 SKUs) ───
  logger.info("[LacheLivre] Setting inventory levels...")
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: { sku: BUNDLE_VARIANTS.map((b) => b.sku) },
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
      logger.info(`[LacheLivre] Inventory levels set for ${inventoryItems.length} SKU(s)`)
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[LacheLivre] Inventory levels already exist, skipping")
      } else {
        throw e
      }
    }
  }

  // ─── 10. LOG IDs ───
  const finalOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)

  // Re-fetch product with variants for a clean ID dump
  const { data: finalProduct } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku", "variants.title"],
    filters: { handle: PRODUCT_HANDLE },
  })

  logger.info("═══════════════════════════════════════════")
  logger.info("[LacheLivre] SETUP COMPLETE!")
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info(`Region ID (EUR): ${region.id}`)
  logger.info(`Stock Location ID: ${stockLocation.id}`)
  logger.info(`Fulfillment Set ID: ${fulfillmentSet.id}`)
  logger.info(`Product ID: ${finalProduct?.[0]?.id}`)
  logger.info("Variants (SKU → id):")
  for (const v of finalProduct?.[0]?.variants || []) {
    logger.info(`  ${v.sku} (${v.title}) → ${v.id}`)
  }
  if (apiKeyToken) {
    logger.info(`Publishable API Key: ${apiKeyToken}`)
  }
  logger.info("")
  logger.info("Shipping options under this service zone:")
  for (const o of finalOptions) {
    logger.info(`  - ${o.name} (${o.id})`)
  }
  logger.info("")
  logger.info("Follow-ups:")
  logger.info("  1. storefront lache-livre config → publishableApiKey, regions.FR, bundle variantIds")
  logger.info("  2. country-order-config.ts → lache-livre entry (sales_channel_id + Packeta FR shipping option IDs)")
  logger.info("  3. add-bundle-to-cart.ts → BUNDLE_PRICING['lache-prise'] {1:36,2:61,3:82,4:102} + SKU pattern /^LACHE-(\\d+)$/")
  logger.info("  4. dextrum_delivery_mapping → map FR shipping options → Packeta delivery methods")
  logger.info("  5. gateway_config DB → add 'lache-livre' to Airwallex + PayPal + Klarna project_slugs")
  logger.info("═══════════════════════════════════════════")
}
