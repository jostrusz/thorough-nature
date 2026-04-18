import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
} from "@medusajs/framework/utils"
import {
  createShippingOptionsWorkflow,
  createStockLocationsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Seeds a dedicated Czech fulfillment setup for the "Kocici Bible" project.
 *
 * Mirrors the Psí superživot setup exactly:
 *   - Own stock location "Kocici Bible Warehouse" in Praha
 *   - Own fulfillment set "Kocici Bible shipping" with a CZ service zone
 *   - Two Zásilkovna shipping options: "Na výdejní místo" (0 CZK) and
 *     "Na adresu" (20 CZK), both flat-priced in CZK and visible in store
 *   - Links the new stock location to the Kocici Bible sales channel
 *
 * Idempotent — safe to re-run. If a stock location, fulfillment set or
 * shipping option with the expected name already exists, it is reused.
 *
 * Run with:
 *   pnpm medusa exec ./src/scripts/seed-kocici-bible-fulfillment.ts
 */
export default async function seedKociciBibleFulfillment({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  // ─── 1. SALES CHANNEL (must already exist from seed-kocici-bible.ts) ───
  logger.info("[KociciBibleFulfillment] Finding Kocici Bible sales channel...")
  const existingSalesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Kocici Bible",
  })
  if (!existingSalesChannels.length) {
    throw new Error(
      "Sales channel 'Kocici Bible' not found. Run seed-kocici-bible.ts first."
    )
  }
  const salesChannel = existingSalesChannels[0]
  logger.info(`[KociciBibleFulfillment] Using sales channel: ${salesChannel.id}`)

  // ─── 2. SHIPPING PROFILE (reuse default) ───
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfiles.length) {
    throw new Error("No default shipping profile found.")
  }
  const shippingProfile = shippingProfiles[0]

  // ─── 3. STOCK LOCATION ───
  logger.info("[KociciBibleFulfillment] Creating stock location...")
  let stockLocation: any
  try {
    const { result: stockLocationResult } = await createStockLocationsWorkflow(
      container
    ).run({
      input: {
        locations: [
          {
            name: "Kocici Bible Warehouse",
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
    logger.info(
      `[KociciBibleFulfillment] Created stock location: ${stockLocation.id}`
    )

    // Link the location to the manual fulfillment provider
    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
    })
  } catch (e: any) {
    // If name conflict, look it up instead
    if (e.message?.includes("already exists") || e.message?.includes("duplicate")) {
      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: locs } = await query.graph({
        entity: "stock_location",
        fields: ["id", "name"],
      })
      stockLocation = locs.find((l: any) => l.name === "Kocici Bible Warehouse")
      if (!stockLocation) throw e
      logger.info(
        `[KociciBibleFulfillment] Reusing stock location: ${stockLocation.id}`
      )
    } else {
      throw e
    }
  }

  // ─── 4. FULFILLMENT SET ───
  logger.info("[KociciBibleFulfillment] Creating fulfillment set...")
  const existingFulfillmentSets = await fulfillmentModuleService.listFulfillmentSets(
    { name: "Kocici Bible shipping" },
    { relations: ["service_zones"] }
  )
  let fulfillmentSet = existingFulfillmentSets.length ? existingFulfillmentSets[0] : null

  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
      name: "Kocici Bible shipping",
      type: "shipping",
      service_zones: [
        {
          name: "Czech rep",
          geo_zones: [{ country_code: "cz", type: "country" as const }],
        },
      ],
    })

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
    logger.info(
      `[KociciBibleFulfillment] Created fulfillment set: ${fulfillmentSet.id}`
    )
  } else {
    logger.info(
      `[KociciBibleFulfillment] Reusing fulfillment set: ${fulfillmentSet.id}`
    )
  }

  const serviceZone = fulfillmentSet.service_zones[0]

  // ─── 5. SHIPPING OPTIONS ───
  logger.info("[KociciBibleFulfillment] Creating shipping options...")

  // Helper: check if a shipping option with the given name already exists under
  // our service zone, so we can skip on re-runs.
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
    logger.info(
      `[KociciBibleFulfillment] Created ${shippingOptionsToCreate.length} shipping option(s)`
    )
  } else {
    logger.info(
      `[KociciBibleFulfillment] All shipping options already exist, skipping`
    )
  }

  // ─── 6. LINK SALES CHANNEL TO STOCK LOCATION ───
  try {
    await linkSalesChannelsToStockLocationWorkflow(container).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })
    logger.info(
      `[KociciBibleFulfillment] Linked sales channel ${salesChannel.id} to stock location ${stockLocation.id}`
    )
  } catch (e: any) {
    logger.info(
      `[KociciBibleFulfillment] Sales channel link skipped (likely already linked): ${e.message}`
    )
  }

  // ─── 7. LOG SUMMARY ───
  logger.info("═══════════════════════════════════════════")
  logger.info("[KociciBibleFulfillment] SETUP COMPLETE!")
  logger.info(`Stock Location ID: ${stockLocation.id}`)
  logger.info(`Fulfillment Set ID: ${fulfillmentSet.id}`)
  logger.info(`Service Zone ID: ${serviceZone.id}`)
  logger.info(`Sales Channel ID: ${salesChannel.id}`)
  logger.info("")
  logger.info("Shipping options under this service zone:")
  const finalOptions = await fulfillmentModuleService.listShippingOptions({
    service_zone: { id: serviceZone.id },
  } as any)
  for (const o of finalOptions) {
    logger.info(`  - ${o.name} (${o.id})`)
  }
  logger.info("═══════════════════════════════════════════")
}
