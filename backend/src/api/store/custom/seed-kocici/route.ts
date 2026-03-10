import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
  createSalesChannelsWorkflow,
  createRegionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createShippingOptionsWorkflow,
  createTaxRegionsWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * ONE-TIME seed route: creates Psi Superzivot infrastructure + Kočičí bible product.
 * DELETE THIS FILE after running once!
 * Call: POST /store/custom/seed-kocici
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const link = req.scope.resolve(ContainerRegistrationKeys.LINK)
    const fulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT)
    const salesChannelModuleService = req.scope.resolve(Modules.SALES_CHANNEL)
    const apiKeyModuleService = req.scope.resolve(Modules.API_KEY)
    const regionModuleService = req.scope.resolve(Modules.REGION)

    const log: string[] = []

    // ─── 1. Ensure Psi Superzivot sales channel exists ───
    let salesChannels = await salesChannelModuleService.listSalesChannels({
      name: "Psi Superzivot",
    })
    let salesChannel: any
    if (salesChannels.length) {
      salesChannel = salesChannels[0]
      log.push(`Sales channel exists: ${salesChannel.id}`)
    } else {
      const { result } = await createSalesChannelsWorkflow(req.scope).run({
        input: { salesChannelsData: [{ name: "Psi Superzivot" }] },
      })
      salesChannel = result[0]
      log.push(`Created sales channel: ${salesChannel.id}`)

      // Create publishable API key
      const newKey = await apiKeyModuleService.createApiKeys({
        title: "Psi Superzivot",
        type: "publishable",
        created_by: "seed-route",
      })
      await link.create({
        [Modules.API_KEY]: { publishable_key_id: newKey.id },
        [Modules.SALES_CHANNEL]: { sales_channel_id: salesChannel.id },
      })
      log.push(`Created API key: ${newKey.token}`)
    }

    // ─── 2. Ensure CZ region exists ───
    const existingRegions = await regionModuleService.listRegions({}, {
      relations: ["countries"],
    })
    let region = existingRegions.find((r: any) =>
      r.countries?.some((c: any) => c.iso_2 === "cz")
    )
    if (region) {
      log.push(`Region exists: ${region.id}`)
    } else {
      const { result } = await createRegionsWorkflow(req.scope).run({
        input: {
          regions: [{
            name: "Czech Republic (Psi Superzivot)",
            currency_code: "czk",
            countries: ["cz"],
            payment_providers: ["pp_system_default"],
          }],
        },
      })
      region = result[0]
      log.push(`Created region: ${region.id}`)
    }

    // ─── 3. Tax region ───
    try {
      await createTaxRegionsWorkflow(req.scope).run({
        input: [{
          country_code: "cz",
          provider_id: "tp_system",
          default_tax_rate: { rate: 0, code: "zero-vat-cz", name: "Czech Zero VAT (Books)" },
        }],
      })
      log.push("Created tax region CZ 0%")
    } catch (e: any) {
      if (e.message?.includes("already exists")) {
        log.push("Tax region CZ already exists")
      }
    }

    // ─── 4. Stock location ───
    const { data: existingLocations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    let stockLocation: any
    if (existingLocations.length) {
      stockLocation = existingLocations[0]
      log.push(`Stock location exists: ${stockLocation.id}`)
    } else {
      const { result } = await createStockLocationsWorkflow(req.scope).run({
        input: {
          locations: [{
            name: "Psi Superzivot Warehouse",
            address: { city: "Praha", country_code: "CZ", address_1: "Rybná 716/24" },
          }],
        },
      })
      stockLocation = result[0]
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
      })
      log.push(`Created stock location: ${stockLocation.id}`)
    }

    // ─── 5. Shipping profile ───
    const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({ type: "default" })
    let shippingProfile = shippingProfiles.length ? shippingProfiles[0] : null
    if (!shippingProfile) {
      const { result } = await createShippingProfilesWorkflow(req.scope).run({
        input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
      })
      shippingProfile = result[0]
      log.push(`Created shipping profile: ${shippingProfile.id}`)
    }

    // ─── 6. Fulfillment set ───
    const existingFulfillmentSets = await fulfillmentModuleService.listFulfillmentSets({
      name: "Psi Superzivot Delivery",
    }, { relations: ["service_zones"] })
    if (!existingFulfillmentSets.length) {
      const fulfillmentSet = await fulfillmentModuleService.createFulfillmentSets({
        name: "Psi Superzivot Delivery",
        type: "shipping",
        service_zones: [{
          name: "Czech Republic",
          geo_zones: [{ country_code: "cz", type: "country" as const }],
        }],
      })
      await link.create({
        [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
        [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
      })
      await createShippingOptionsWorkflow(req.scope).run({
        input: [{
          name: "Doprava zdarma",
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: fulfillmentSet.service_zones[0].id,
          shipping_profile_id: shippingProfile.id,
          type: { label: "Standard", description: "Doprava zdarma po celé ČR", code: "standard" },
          prices: [
            { currency_code: "czk", amount: 0 },
            { region_id: region.id, amount: 0 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        }],
      })
      log.push("Created fulfillment set + shipping option")
    } else {
      log.push("Fulfillment set already exists")
    }

    await linkSalesChannelsToStockLocationWorkflow(req.scope).run({
      input: { id: stockLocation.id, add: [salesChannel.id] },
    })

    // ─── 7. Create Psí superživot product (main product) ───
    const { data: existingMain } = await query.graph({
      entity: "product",
      fields: ["id", "handle", "variants.id"],
      filters: { handle: "psi-superzivot" },
    })
    if (existingMain.length) {
      log.push(`Main product exists: ${existingMain[0].id} (variant: ${existingMain[0].variants?.[0]?.id})`)
    } else {
      const { result } = await createProductsWorkflow(req.scope).run({
        input: {
          products: [{
            title: "Psí superživot",
            description: "Kompletní 4-pilířový systém pro klidného a poslušného psa.",
            handle: "psi-superzivot",
            weight: 500,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Formát", values: ["Paperback"] }],
            variants: [{
              title: "Paperback",
              sku: "PSI-SUPERZIVOT-PB",
              options: { "Formát": "Paperback" },
              prices: [{ amount: 550, currency_code: "czk" }],
              manage_inventory: true,
            }],
            sales_channels: [{ id: salesChannel.id }],
          }],
        },
      })
      log.push(`Created main product: ${result[0].id} (variant: ${result[0].variants?.[0]?.id})`)

      // Inventory for main product
      const { data: mainInvItems } = await query.graph({
        entity: "inventory_item",
        fields: ["id", "sku"],
        filters: { sku: ["PSI-SUPERZIVOT-PB"] },
      })
      if (mainInvItems.length) {
        await createInventoryLevelsWorkflow(req.scope).run({
          input: {
            inventory_levels: mainInvItems.map((item: any) => ({
              location_id: stockLocation.id,
              stocked_quantity: 1000000,
              inventory_item_id: item.id,
            })),
          },
        })
      }
    }

    // ─── 8. Create Kočičí bible product (upsell) ───
    const { data: existingUpsell } = await query.graph({
      entity: "product",
      fields: ["id", "handle", "variants.id"],
      filters: { handle: "kocici-bible" },
    })
    if (existingUpsell.length) {
      log.push(`Upsell product exists: ${existingUpsell[0].id} (variant: ${existingUpsell[0].variants?.[0]?.id})`)
      return res.json({ success: true, log, variantId: existingUpsell[0].variants?.[0]?.id })
    }

    const { result: productResult } = await createProductsWorkflow(req.scope).run({
      input: {
        products: [{
          title: "Kočičí bible",
          description: "Kompletní průvodce pro spokojený život s kočkou. 5 pilířů: Výživa, Psychologie, Péče, Výchova, Pouto. 220+ stran. Autor: Michal Peterka.",
          handle: "kocici-bible",
          weight: 450,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Formát", values: ["Paperback"] }],
          variants: [{
            title: "Paperback",
            sku: "KOCICI-BIBLE-PB",
            options: { "Formát": "Paperback" },
            prices: [{ amount: 550, currency_code: "czk" }],
            manage_inventory: true,
          }],
          sales_channels: [{ id: salesChannel.id }],
        }],
      },
    })

    // Inventory
    const { data: invItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku"],
      filters: { sku: ["KOCICI-BIBLE-PB"] },
    })
    if (invItems.length) {
      await createInventoryLevelsWorkflow(req.scope).run({
        input: {
          inventory_levels: invItems.map((item: any) => ({
            location_id: stockLocation.id,
            stocked_quantity: 1000000,
            inventory_item_id: item.id,
          })),
        },
      })
    }

    const product = productResult[0]
    log.push(`Created upsell product: ${product.id} (variant: ${product.variants?.[0]?.id})`)

    return res.json({
      success: true,
      log,
      productId: product.id,
      variantId: product.variants?.[0]?.id,
    })
  } catch (err: any) {
    console.error("Seed kocici-bible error:", err)
    return res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) })
  }
}
