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
  updateProductsWorkflow,
  updateProductVariantsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Seeds the order-bump upsell product for the zivot-zaslugy checkout:
 * "Pusť to, co tě ničí – upsell" at the discounted bump price 599 CZK
 * (regular 749 Kč).
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
  const SOURCE_HANDLE = "pust-to-co-te-nici"
  const SKU = "OTCCN64787237-3"
  const TITLE = "Pusť to, co tě ničí – upsell"
  const DESCRIPTION =
    "Samostatný order-bump produkt knihy Pusť to, co tě ničí pro checkout Život, který si zasloužíš. Autor Joris de Vries, 290 stran včetně praktického pracovního sešitu."
  const PRICE = 599

  const source = await query.graph({
    entity: "product",
    fields: ["id", "thumbnail", "images.url"],
    filters: { handle: SOURCE_HANDLE },
  })
  const sourceProduct = source.data?.[0]
  if (!sourceProduct) {
    throw new Error(`[ZivotUpsell] Source product '${SOURCE_HANDLE}' not found`)
  }
  const sourceThumbnail = sourceProduct.thumbnail || sourceProduct.images?.[0]?.url || null
  const sourceImages = (sourceProduct.images || [])
    .map((image: any) => image?.url)
    .filter(Boolean)
    .map((url: string) => ({ url }))

  const existing = await query.graph({
    entity: "product",
    fields: ["id", "handle", "variants.id", "variants.sku"],
    filters: { handle: HANDLE },
  })
  if (existing.data?.length) {
    const p = existing.data[0]
    const variant = p.variants?.[0]
    if (!variant?.id) {
      throw new Error(`[ZivotUpsell] Existing product '${HANDLE}' has no variant`)
    }

    await updateProductsWorkflow(container).run({
      input: {
        selector: { id: p.id },
        update: {
          title: TITLE,
          description: DESCRIPTION,
          thumbnail: sourceThumbnail,
          ...(sourceImages.length ? { images: sourceImages } : {}),
        },
      },
    })
    await updateProductVariantsWorkflow(container).run({
      input: {
        selector: { id: variant.id, product_id: p.id },
        update: {
          title: "Paperback – upsell",
          sku: SKU,
          prices: [{ amount: PRICE, currency_code: "czk" }],
        },
      },
    })

    logger.info(`[ZivotUpsell] Normalized product ${p.id}, variant ${variant.id}`)
    console.log(JSON.stringify({ productId: p.id, variantId: variant.id, sku: SKU, price: PRICE }))
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
          title: TITLE,
          description: DESCRIPTION,
          handle: HANDLE,
          thumbnail: sourceThumbnail,
          ...(sourceImages.length ? { images: sourceImages } : {}),
          weight: 500,
          status: ProductStatus.PUBLISHED,
          shipping_profile_id: shippingProfile.id,
          options: [{ title: "Format", values: ["Paperback"] }],
          variants: [
            {
              title: "Paperback – upsell",
              sku: SKU,
              options: { Format: "Paperback" },
              prices: [{ amount: PRICE, currency_code: "czk" }],
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
