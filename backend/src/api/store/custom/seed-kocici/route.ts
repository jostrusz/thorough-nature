import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import {
  createInventoryLevelsWorkflow,
  createProductsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * ONE-TIME seed route: creates "Kočičí bible" product.
 * DELETE THIS FILE after running once!
 * Call: POST /store/custom/seed-kocici
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const fulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT)
    const salesChannelModuleService = req.scope.resolve(Modules.SALES_CHANNEL)

    // Check if product already exists
    const { data: existingProducts } = await query.graph({
      entity: "product",
      fields: ["id", "handle", "variants.id"],
      filters: { handle: "kocici-bible" },
    })
    if (existingProducts.length) {
      return res.json({
        success: true,
        message: "Product already exists",
        productId: existingProducts[0].id,
        variantId: existingProducts[0].variants?.[0]?.id,
      })
    }

    // Find sales channel
    const salesChannels = await salesChannelModuleService.listSalesChannels({
      name: "Psi Superzivot",
    })
    if (!salesChannels.length) {
      return res.status(400).json({ error: "Sales channel 'Psi Superzivot' not found" })
    }
    const salesChannel = salesChannels[0]

    // Find shipping profile
    const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
      type: "default",
    })
    if (!shippingProfiles.length) {
      return res.status(400).json({ error: "No default shipping profile found" })
    }
    const shippingProfile = shippingProfiles[0]

    // Find stock location
    const { data: stockLocations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    if (!stockLocations.length) {
      return res.status(400).json({ error: "No stock location found" })
    }
    const stockLocation = stockLocations[0]

    // Create product
    const { result: productResult } = await createProductsWorkflow(req.scope).run({
      input: {
        products: [
          {
            title: "Kočičí bible",
            description:
              "Kompletní průvodce pro spokojený život s kočkou. 5 pilířů: Výživa, Psychologie, Péče, Výchova, Pouto. 220+ stran praktických rad. Autor: Michal Peterka.",
            handle: "kocici-bible",
            weight: 450,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Formát", values: ["Paperback"] }],
            variants: [
              {
                title: "Paperback",
                sku: "KOCICI-BIBLE-PB",
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

    // Set inventory
    const { data: inventoryItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku"],
      filters: { sku: ["KOCICI-BIBLE-PB"] },
    })

    if (inventoryItems.length) {
      await createInventoryLevelsWorkflow(req.scope).run({
        input: {
          inventory_levels: inventoryItems.map((item: any) => ({
            location_id: stockLocation.id,
            stocked_quantity: 1000000,
            inventory_item_id: item.id,
          })),
        },
      })
    }

    const product = productResult[0]
    return res.json({
      success: true,
      message: "Product created!",
      productId: product.id,
      variantId: product.variants?.[0]?.id,
      sku: "KOCICI-BIBLE-PB",
    })
  } catch (err: any) {
    console.error("Seed kocici-bible error:", err)
    return res.status(500).json({ error: err.message })
  }
}
