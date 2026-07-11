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
} from "@medusajs/medusa/core-flows"

/**
 * Seeds the order-bump upsell product for the zivot-zaslugy checkout:
 * "Pusť to, co tě ničí" at the discounted bump price 549 CZK (regular 749 Kč).
 *
 * Mirrors the zycie-zaslugy → odpusc cross-sell pattern: a dedicated product
 * with its own handle + variant so the discounted price lives on the variant
 * (add-bundle-to-cart falls back to variant price for unknown handles).
 *
 * SKU "OTCCN64787237-3" maps to the physical odpust book barcode
 * OTCCN64787237 in the Dextrum BUNDLE_SKU_MAP (suffix -3 = third cross-sell
 * variant of the same physical book; -2 is the zycie bump).
 *
 * Idempotent — safe to re-run.
 * Run with: pnpm medusa exec ./src/scripts/seed-zivot-upsell.ts
 */
export default async function seedZivotUpsell({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  const HANDLE = "pust-to-co-te-nici-zkz"
  const SKU = "OTCCN64787237-3"

  const existing = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: HANDLE },
  })
  if (existing.data?.length) {
    const p = existing.data[0]
    logger.info(`[ZivotUpsell] Product exists: ${p.id}, variant: ${p.variants?.[0]?.id}`)
    console.log(JSON.stringify({ productId: p.id, variantId: p.variants?.[0]?.id }))
    return
  }

  const channels = await salesChannelModuleService.listSalesChannels({
    name: "Zivot Zaslugy",
  })
  if (!channels.length) {
    throw new Error("[ZivotUpsell] Sales channel 'Zivot Zaslugy' not found — run seed-zivot-zaslugy first")
  }
  const salesChannel = channels[0]

  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name"],
  })
  const shippingProfile = profiles.find((p: any) => p.type === "default") || profiles[0]

  const { result } = await createProductsWorkflow(container).run({
    input: {
      products: [
        {
          title: "Pusť to, co tě ničí (ZKZ Upsell)",
          description:
            "Kniha, která ti pomůže zastavit příval myšlenek, zklidnit emoce a najít vnitřní klid. Zvýhodněná cena k objednávce knihy Život, který si zasloužíš.",
          handle: HANDLE,
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback",
              sku: SKU,
              options: { Format: "Paperback" },
              prices: [{ amount: 549, currency_code: "czk" }],
              manage_inventory: true,
            },
          ],
          sales_channels: [{ id: salesChannel.id }],
        },
      ],
    },
  })
  const product = result[0]
  logger.info(`[ZivotUpsell] Created product ${product.id}`)

  // Inventory level in the zivot warehouse (physical stock is the shared
  // odpust book at Dextrum; level here only satisfies manage_inventory)
  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
    filters: { name: "Zivot Zaslugy Warehouse" },
  })
  const { data: inventoryItems } = await query.graph({
    entity: "inventory_item",
    fields: ["id", "sku"],
    filters: { sku: SKU },
  })
  if (stockLocations.length && inventoryItems.length) {
    await createInventoryLevelsWorkflow(container).run({
      input: {
        inventory_levels: inventoryItems.map((item: any) => ({
          inventory_item_id: item.id,
          location_id: stockLocations[0].id,
          stocked_quantity: 100000,
        })),
      },
    })
    logger.info(`[ZivotUpsell] Inventory level set`)
  } else {
    logger.warn(`[ZivotUpsell] Stock location or inventory item not found — inventory level skipped`)
  }

  const { data: created } = await query.graph({
    entity: "product",
    fields: ["id", "variants.id", "variants.sku"],
    filters: { handle: HANDLE },
  })
  console.log(JSON.stringify({ productId: created[0].id, variantId: created[0].variants?.[0]?.id }))
}
