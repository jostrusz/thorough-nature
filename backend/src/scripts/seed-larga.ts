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
 * Seeds the "larga" project — Portuguese edition of the book
 * "Larga o que te destrói" (Joris de Vries), cloned 1:1 from seed-suelta.ts.
 * Portugal uses EUR; this creates its OWN:
 *   - EUR region (country pt)          ← dedicated, isolated from the shared Europe region
 *   - sales channel "larga" + publishable API key
 *   - dedicated stock location (physically the shared Dextrum CZ warehouse)
 *   - PT tax region with the 6% reduced book VAT (taxa reduzida, continente)
 *   - home-delivery shipping option (free)
 *   - product "Larga o que te destrói" (handle larga-o-que-te-destroi) with
 *     4 per-bundle variants: SKU LARGA-1..4 → 36/61/82/102 €
 *
 * Payment providers wired for PT: Revolut (cards + wallets), PayPal, Klarna.
 *
 * NOTE on VAT: Portugal applies 6% (taxa reduzida) to printed books on the
 * mainland. Madeira (5%) and the Azores (4%) have lower regional rates, but
 * Medusa tax regions are per-country — prices are tax-inclusive, so this only
 * shifts the VAT breakdown on the invoice, never the amount the customer pays.
 *
 * NOTE on shipping: like Spain there are no pickup points wired for Portugal —
 * home delivery only, routed through the shared Dextrum CZ warehouse. The
 * physical carrier for PT is still OPEN (see follow-up 4 below); until a
 * dextrum_delivery_mapping row exists, orders will sit at WAITING exactly like
 * the two live suelta orders do today.
 *
 * Idempotent — safe to re-run.
 * Run with: pnpm medusa exec ./src/scripts/seed-larga.ts
 */
export default async function seedLarga({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)
  const regionModuleService = container.resolve(Modules.REGION)
  const apiKeyModuleService = container.resolve(Modules.API_KEY)

  const SALES_CHANNEL_NAME = "larga"
  const PRODUCT_HANDLE = "larga-o-que-te-destroi"
  const STOCK_LOCATION_NAME = "Larga PT Warehouse"
  const FULFILLMENT_SET_NAME = "Larga PT shipping"
  const REGION_NAME = "Portugal (Larga)"

  // Per-bundle variants. SKU encodes the bundle qty; the server-side
  // add-bundle-to-cart workflow resolves the price via BUNDLE_PRICING.
  const BUNDLE_VARIANTS = [
    { qty: 1, sku: "LARGA-1", price: 36, label: "1 livro" },
    { qty: 2, sku: "LARGA-2", price: 61, label: "2 livros" },
    { qty: 3, sku: "LARGA-3", price: 82, label: "3 livros" },
    { qty: 4, sku: "LARGA-4", price: 102, label: "4 livros" },
  ]

  // ─── 1. SALES CHANNEL ───
  logger.info("[Larga] Setting up sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  let salesChannel: any
  let apiKeyToken: string | null = null
  if (existingSalesChannels.length) {
    salesChannel = existingSalesChannels[0]
    logger.info(`[Larga] Reusing existing sales channel: ${salesChannel.id}`)
  } else {
    const { result: salesChannelResult } = await createSalesChannelsWorkflow(
      container
    ).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    })
    salesChannel = salesChannelResult[0]
    logger.info(`[Larga] Created sales channel: ${salesChannel.id}`)

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
    logger.info(`[Larga] Created API key: ${newKey.token}`)
  }

  // ─── 2. REGION (NEW — dedicated Portugal EUR region) ───
  logger.info("[Larga] Setting up PT/EUR region...")
  const allRegions = await regionModuleService.listRegions({}, {
    relations: ["countries"],
  })
  let region = allRegions.find((r: any) =>
    r.countries?.some((c: any) => c.iso_2 === "pt")
  )
  if (region) {
    logger.info(`[Larga] Reusing existing PT region: ${region.id} (${region.name})`)
  } else {
    // PT gateways routed by the custom gateway_config layer: Revolut (cards +
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
            countries: ["pt"],
            payment_providers: paymentProviderIds,
            is_tax_inclusive: true,
          } as any,
        ],
      },
    })
    region = regionResult[0]
    logger.info(`[Larga] Created PT region: ${region.id} (EUR, providers: ${paymentProviderIds.join(", ")})`)
  }

  // ─── 3. TAX REGION (Portugal — reduced book VAT 6%) ───
  logger.info("[Larga] Setting up PT tax region...")
  try {
    const { data: existingTaxRegions } = await query.graph({
      entity: "tax_region",
      fields: ["id", "country_code"],
      filters: { country_code: "pt" } as any,
    })
    if (existingTaxRegions?.length) {
      logger.info(`[Larga] PT tax region already exists: ${existingTaxRegions[0].id} (verify 6% book rate)`)
    } else {
      await createTaxRegionsWorkflow(container).run({
        input: [
          {
            country_code: "pt",
            provider_id: "tp_system",
            default_tax_rate: {
              // Portugal applies the reduced 6% VAT (taxa reduzida, Lista I)
              // to printed books on the mainland. Prices are tax-inclusive, so
              // this only affects the invoice VAT breakdown.
              name: "Portuguese Book VAT (6%)",
              code: "reduced-vat-pt",
              rate: 6,
            },
          } as any,
        ],
      })
      logger.info("[Larga] Created PT tax region (6% book VAT)")
    }
  } catch (e: any) {
    logger.info(`[Larga] Tax region step skipped: ${e.message}`)
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
  logger.info("[Larga] Setting up stock location...")
  let stockLocation: any
  {
    const { data: locs } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    stockLocation = locs.find((l: any) => l.name === STOCK_LOCATION_NAME)
  }
  if (stockLocation) {
    logger.info(`[Larga] Reusing stock location: ${stockLocation.id}`)
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
    logger.info(`[Larga] Created stock location: ${stockLocation.id}`)

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  }

  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(`[Larga] Linked sales channel to stock location`)
  } catch (e: any) {
    logger.info(`[Larga] Stock location link skipped: ${e.message}`)
  }

  // ─── 6. FULFILLMENT SET + SERVICE ZONE (PT geo zone) ───
  logger.info("[Larga] Setting up fulfillment set...")
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
          name: "Portugal (Larga)",
          geo_zones: [{ country_code: "pt", type: "country" as const }],
        },
      ],
    })
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info(`[Larga] Created fulfillment set: ${fulfillmentSet.id}`)
  } else {
    logger.info(`[Larga] Reusing fulfillment set: ${fulfillmentSet.id}`)
  }

  const serviceZone = fulfillmentSet.service_zones[0]

  // ─── 7. SHIPPING OPTION (home delivery, free — no pickup points in PT) ───
  logger.info("[Larga] Setting up shipping options...")
  const existingOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)
  const optionExists = (name: string) =>
    existingOptions.some((o: any) => o.name === name)

  const shippingOptionsToCreate: any[] = []

  if (!optionExists("Envio ao domicílio")) {
    shippingOptionsToCreate.push({
      name: "Envio ao domicílio",
      price_type: "flat",
      provider_id: "manual_manual",
      service_zone_id: serviceZone.id,
      shipping_profile_id: shippingProfile.id,
      type: {
        label: "Envio ao domicílio",
        description: "Entrega em tua casa, portes grátis",
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
    logger.info(`[Larga] Created ${shippingOptionsToCreate.length} shipping option(s)`)
  } else {
    logger.info(`[Larga] All shipping options already exist, skipping`)
  }

  // ─── 8. PRODUCT "Larga o que te destrói" (4 per-bundle variants) ───
  logger.info(`[Larga] Creating product 'Larga o que te destrói'...`)
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: PRODUCT_HANDLE },
  })

  let product: any
  if (existingProducts.length) {
    product = existingProducts[0]
    logger.info(`[Larga] Product already exists: ${product.id}`)
  } else {
    const { result: productResult } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: "Larga o que te destrói",
            subtitle: "Começa a viver uma vida autêntica",
            description:
              "Edição portuguesa do bestseller. Um guia prático para deixares de dar voltas à cabeça e te libertares da culpa, das relações tóxicas e do passado que te trava. Autor: Joris de Vries.",
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
    logger.info(`[Larga] Created product: ${product.id} with ${product.variants?.length || 0} variants`)
  }

  // ─── 9. INVENTORY LEVELS (all 4 SKUs) ───
  logger.info("[Larga] Setting inventory levels...")
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
      logger.info(`[Larga] Inventory levels set for ${inventoryItems.length} SKU(s)`)
    } catch (e: any) {
      if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
        logger.info("[Larga] Inventory levels already exist, skipping")
      } else {
        throw e
      }
    }
  }

  // ─── 10. LOG IDs ───
  const finalOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)

  const { data: finalProduct } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku", "variants.title"],
    filters: { handle: PRODUCT_HANDLE },
  })

  logger.info("═══════════════════════════════════════════")
  logger.info("[Larga] SETUP COMPLETE!")
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
  logger.info("  1. storefront larga config → publishableApiKey, regions.PT, bundle variantIds")
  logger.info("  2. country-order-config.ts → larga entry (sales_channel_id + PT shipping option ID)")
  logger.info("  3. add-bundle-to-cart.ts → BUNDLE_PRICING['larga-o-que-te-destroi'] {1:36,2:61,3:82,4:102} + SKU /^LARGA-(\\d+)$/")
  logger.info("  4. dextrum_delivery_mapping → map the PT shipping option to a carrier (STILL OPEN, same as ES)")
  logger.info("  5. gateway_config DB → add 'larga' to Revolut + PayPal + Klarna project_slugs")
  logger.info("═══════════════════════════════════════════")
}
