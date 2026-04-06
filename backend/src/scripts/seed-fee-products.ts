import { ExecArgs } from "@medusajs/framework/types"
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
 * Seed fee products for the psi-superzivot project:
 * - "Doprava na adresu" (20 CZK) — charged when customer picks home delivery
 * - "Příplatek za dobírku" (30 CZK) — charged when customer pays with COD
 *
 * These are added as line items to the cart so they appear in order.total,
 * Fakturoid invoices, and Medusa admin.
 *
 * Usage: npx medusa exec src/scripts/seed-fee-products.ts
 */
export default async function seedFeeProducts({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const fulfillmentModuleService = container.resolve(Modules.FULFILLMENT)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  // Find existing sales channel
  const salesChannels = await salesChannelModuleService.listSalesChannels({
    name: "Psi Superzivot",
  })
  if (!salesChannels.length) {
    logger.error("[SeedFees] Sales channel 'Psi Superzivot' not found. Run seed-psi-superzivot first.")
    return
  }
  const salesChannel = salesChannels[0]

  // Find shipping profile
  const shippingProfiles = await fulfillmentModuleService.listShippingProfiles({
    type: "default",
  })
  const shippingProfile = shippingProfiles[0]
  if (!shippingProfile) {
    logger.error("[SeedFees] No default shipping profile found.")
    return
  }

  // Check if fee products already exist
  const { data: existingProducts } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.*"],
    filters: {
      handle: ["doprava-na-adresu", "priplatek-za-dobirku"],
    },
  })

  if (existingProducts.length === 2) {
    logger.warn("[SeedFees] Fee products already exist:")
    for (const p of existingProducts) {
      for (const v of p.variants || []) {
        logger.info(`  ${p.handle}: variant ${v.id} (sku: ${v.sku})`)
      }
    }
    return
  }

  // Create products that don't exist yet
  const productsToCreate: any[] = []
  const existingHandles = existingProducts.map((p: any) => p.handle)

  if (!existingHandles.includes("doprava-na-adresu")) {
    productsToCreate.push({
      title: "Doprava na adresu",
      description: "Příplatek za doručení na adresu přes Zásilkovnu",
      handle: "doprava-na-adresu",
      weight: 0,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      options: [{ title: "Typ", values: ["Poplatek"] }],
      variants: [
        {
          title: "Doprava na adresu",
          sku: "FEE-DELIVERY-HOME",
          options: { Typ: "Poplatek" },
          prices: [{ amount: 20, currency_code: "czk" }],
          manage_inventory: false,
        },
      ],
      sales_channels: [{ id: salesChannel.id }],
    })
  }

  if (!existingHandles.includes("priplatek-za-dobirku")) {
    productsToCreate.push({
      title: "Příplatek za dobírku",
      description: "Příplatek za platbu na dobírku",
      handle: "priplatek-za-dobirku",
      weight: 0,
      status: ProductStatus.PUBLISHED,
      shipping_profile_id: shippingProfile.id,
      options: [{ title: "Typ", values: ["Poplatek"] }],
      variants: [
        {
          title: "Příplatek za dobírku",
          sku: "FEE-COD",
          options: { Typ: "Poplatek" },
          prices: [{ amount: 30, currency_code: "czk" }],
          manage_inventory: false,
        },
      ],
      sales_channels: [{ id: salesChannel.id }],
    })
  }

  if (!productsToCreate.length) {
    logger.info("[SeedFees] All fee products already exist.")
    return
  }

  logger.info(`[SeedFees] Creating ${productsToCreate.length} fee product(s)...`)
  const { result: productResult } = await createProductsWorkflow(container).run({
    input: { products: productsToCreate },
  })

  // Log results
  logger.info("═══════════════════════════════════════════")
  logger.info("[SeedFees] Fee products created!")
  for (const product of productResult) {
    for (const variant of product.variants || []) {
      logger.info(`  ${product.handle}: variant ${variant.id} (sku: ${variant.sku})`)
    }
  }
  logger.info("═══════════════════════════════════════════")
}
