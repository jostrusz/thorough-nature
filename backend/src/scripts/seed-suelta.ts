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
 * Seeds the "suelta" project — Spanish edition of the book
 * "Suelta lo que te destruye" (Joris de Vries), cloned from the Dutch
 * loslatenboek / French lache-livre. Spain uses EUR; this creates its OWN:
 *   - EUR region (country es)          ← dedicated, isolated from the shared Europe region
 *   - sales channel "suelta" + publishable API key
 *   - dedicated stock location (physically the shared Dextrum CZ warehouse)
 *   - ES tax region with the 4% super-reduced book VAT (tipo superreducido)
 *   - home-delivery shipping option (free)
 *   - product "Suelta lo que te destruye" (handle suelta-lo-que-te-destruye) with
 *     4 per-bundle variants: SKU SUELTA-1..4 → 36/61/82/102 €
 *
 * Payment providers wired for ES: Revolut (cards + wallets), PayPal, Klarna.
 *
 * NOTE on shipping: unlike FR/PL/HU there are no pickup points configured for
 * Spain — only home delivery. The physical carrier is still open (see the 3PL
 * evaluation); until that lands, orders route through the shared Dextrum CZ
 * warehouse like every other market.
 *
 * Idempotent — safe to re-run.
 * Run with: pnpm medusa exec ./src/scripts/seed-suelta.ts
 */
export default async function seedSuelta({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "suelta"
  const PRODUCT_HANDLE = "suelta-lo-que-te-destruye"
  const STOCK_LOCATION_NAME = "Suelta ES Warehouse"
  const FULFILLMENT_SET_NAME = "Suelta ES shipping"
  const REGION_NAME = "Spain (Suelta)"

  // Per-bundle variants (like loslatenboek). SKU encodes the bundle qty; the
  // server-side add-bundle-to-cart workflow resolves the price via BUNDLE_PRICING.
  const BUNDLE_VARIANTS = [
    { qty: 1, sku: "SUELTA-1", price: 36, label: "1 libro" },
    { qty: 2, sku: "SUELTA-2", price: 61, label: "2 libros" },
    { qty: 3, sku: "SUELTA-3", price: 82, label: "3 libros" },
    { qty: 4, sku: "SUELTA-4", price: 102, label: "4 libros" },
  ]

  // ─── 1. SALES CHANNEL ───
  logger.info("[Suelta] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[Suelta] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[Suelta] Created sales channel: ${salesChannel.id}`)

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
    logger.info(`[Suelta] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (NEW — dedicated Spain EUR region) ───
  logger.info("[Suelta] Setting up ES/EUR region...")
  const allRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  let region = allRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "es")
  )
  if (region) {
    logger.info(`[Suelta] Reusing existing ES region: ${region.id} (${region.name})`)
  } else {
    // ES gateways routed by the custom gateway_config layer: Revolut (cards +
    // Apple/Google Pay) + PayPal + Klarna. Airwallex/Stripe kept available so a
    // card fallback can be switched on without a migration.
    const paymentProviderIds = [
      "pp_revolut_revolut",
      "pp_paypal_paypal",
      "pp_klarna_klarna",
      "pp_airwallex_airwallex",
      "pp_stripe_stripe",
      "pp_system_default",
    ]

    const { result: regionResult } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: "eur",
            countries: ["es"],
            payment_providers: paymentProviderIds,
            is_tax_inclusive: true,
          } as any,
        ],
      },
    })
    region = regionResult[0]
    logger.info(`[Suelta] Created ES region: ${region.id} (EUR, providers: ${paymentProviderIds.join(", ")})`)
  }

  // ─── 3. TAX REGION (Spain — super-reduced book VAT 4%) ───
  logger.info("[Suelta] Setting up ES tax region...")
  try {
    const { data: existingTaxRegions } = await query.graph({
      entity: "tax_region",
      fields: ["id", "country_code"],
      filters: { country_code: "es" } as any,
    })
    if (existingTaxRegions?.length) {
      logger.info(`[Suelta] ES tax region already exists: ${existingTaxRegions[0].id} (verify 4% book rate)`)
    } else {
      await createTaxRegionsWorkflow(container).run({
        input: [
          {
            country_code: "es",
            provider_id: "tp_system",
            default_tax_rate: {
              // Spain applies the super-reduced 4% VAT (tipo superreducido) to
              // printed books AND e-books. Prices are tax-inclusive, so this
              // only affects the invoice VAT breakdown.
              name: "Spanish Book VAT (4%)",
              code: "reduced-vat-es",
              rate: 4,
            },
          } as any,
        ],
      })
      logger.info("[Suelta] Created ES tax region (4% book VAT)")
    }
  } catch (e: any) {
    logger.info(`[Suelta] Tax region step skipped: ${e.message}`)
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
  logger.info("[Suelta] Setting up stock location...")
  let stockLocation: any
  {
    const { data: locs } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    stockLocation = locs.find((l: any) => l.name === STOCK_LOCATION_NAME)
  }
  if (stockLocation) {
    logger.info(`[Suelta] Reusing stock location: ${stockLocation.id}`)
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
    logger.info(`[Suelta] Created stock location: ${stockLocation.id}`)

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[Suelta] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[Suelta] Stock location link skipped: ${e.message}`)
  }

  // ─── 6. FULFILLMENT SET + SERVICE ZONE (ES geo zone) ───
  logger.info("[Suelta] Setting up fulfillment set...")
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
          name: "Spain (Suelta)",
          geo_zones: [{ country_code: "es", type: "country" as const }],
        },
      ],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info(`[Suelta] Created fulfillment set: ${fulfillmentSet.id}`)
  } else {
    logger.info(`[Suelta] Reusing fulfillment set: ${fulfillmentSet.id}`)
  }

  const serviceZone = fulfillmentSet.service_zones[0]

  // ─── 7. SHIPPING OPTION (home delivery, free — no pickup points in ES) ───
  logger.info("[Suelta] Setting up shipping options...")
  const existingOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)
  const optionExists = (name: string) =>
    existingOptions.some((o: any) => o.name === name)

  const shippingOptionsToCreate: any[] = []

  if (!optionExists("Envío a domicilio")) {
    shippingOptionsToCreate.push({
      name: "Envío a domicilio",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: serviceZone.id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Envío a domicilio",
        description: "Entrega en tu domicilio, envío gratuito",
        code: "home-delivery",
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
    logger.info(`[Suelta] Created ${shippingOptionsToCreate.length} shipping option(s)`)
  } else {
    logger.info(`[Suelta] All shipping options already exist, skipping`)
  }

  // ─── 8. PRODUCT "Suelta lo que te destruye" (4 per-bundle variants) ───
  logger.info(`[Suelta] Creating product 'Suelta lo que te destruye'...`)
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[Suelta] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Suelta lo que te destruye",
            subtitle: "Empieza a vivir una vida auténtica",
            description:
              "Edición española del bestseller. Una guía práctica para dejar de darle vueltas a todo, liberarte de la culpa, de las relaciones tóxicas y del pasado que te frena. Autor: Joris de Vries.",
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
    logger.info(`[Suelta] Created product: ${product.id} with ${product.variants?.length || 0} variants`)
  }

  // ─── 9. INVENTORY LEVELS (all 4 SKUs) ───
  logger.info("[Suelta] Setting inventory levels...")
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
      logger.info(`[Suelta] Inventory levels set for ${inventoryItems.length} SKU(s)`)
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[Suelta] Inventory levels already exist, skipping")
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
  logger.info("[Suelta] SETUP COMPLETE!")
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
  logger.info("  1. storefront suelta config → publishableApiKey, regions.ES, bundle variantIds")
  logger.info("  2. country-order-config.ts → suelta entry (sales_channel_id + ES shipping option ID)")
  logger.info("  3. add-bundle-to-cart.ts → BUNDLE_PRICING['suelta-lo-que-te-destruye'] {1:36,2:61,3:82,4:102} + SKU /^SUELTA-(\\d+)$/")
  logger.info("  4. dextrum_delivery_mapping → map the ES shipping option to a carrier once the 3PL is chosen")
  logger.info("  5. gateway_config DB → add 'suelta' to Revolut + PayPal + Klarna project_slugs")
  logger.info("═══════════════════════════════════════════")
}
