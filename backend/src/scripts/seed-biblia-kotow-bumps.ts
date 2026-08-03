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
 * Seeds the two order-bump upsell products for the biblia-kotow checkout:
 *   1. "Odpuść to, co cię niszczy – upsell"                  99 PLN (regular 119)
 *   2. "Życie, jakiego nigdy sobie nie pozwoliłaś – upsell"  99 PLN (regular 129)
 *
 * Polish mirror of seed-kocici-bumps: a dedicated product + variant per bump so
 * the discounted price lives on the variant (line-items-bundle falls back to the
 * variant price for unknown handles). Thumbnail + gallery are copied from the
 * source products so the covers render in admin AND on the checkout.
 *
 * SKU = parent physical barcode + "-BK". The usual "-2"/"-3" suffixes are already
 * taken by other funnels (OTCCN64787237-2 = zycie-zaslugy upsell, -3 =
 * zivot-zaslugy), so a project-scoped suffix keeps them apart. Dextrum maps it
 * back to the parent barcode — see api/admin/dextrum/orders/[id]/send/route.ts
 * and jobs/dextrum-order-hold.ts.
 *
 * Stock lives on the shared "Odpusc Ksiazka Warehouse" — the Biblia Kotow sales
 * channel has no warehouse of its own; the level here only satisfies
 * manage_inventory, the physical stock is Dextrum's.
 *
 * Idempotent — safe to re-run (updates existing products in place).
 * Run with: pnpm medusa exec ./src/scripts/seed-biblia-kotow-bumps.ts
 */

const SALES_CHANNEL_NAME = "Biblia Kotow"
const STOCK_LOCATION_NAME = "Odpusc Ksiazka Warehouse"
const CURRENCY = "pln"

const BUMPS = [
  {
    handle: "odpusc-to-co-cie-niszczy-bk",
    sourceHandle: "odpusc-to-co-cie-niszczy",
    sku: "OTCCN64787237-BK",
    title: "Odpuść to, co cię niszczy – upsell",
    description:
      "Order-bump wydanie książki Odpuść to, co cię niszczy dla checkoutu Biblii kotów. Joris de Vries — jak zatrzymać nadmierne myślenie, uspokoić emocje i odzyskać wewnętrzny spokój.",
    price: 99,
  },
  {
    handle: "zycie-jakiego-nigdy-sobie-nie-pozwolilas-bk",
    sourceHandle: "zycie-jakiego-nigdy-sobie-nie-pozwolilas",
    sku: "ZJNS827837491-BK",
    title: "Życie, jakiego nigdy sobie nie pozwoliłaś – upsell",
    description:
      "Order-bump wydanie książki Życie, jakiego nigdy sobie nie pozwoliłaś (LIFE RESET™) dla checkoutu Biblii kotów. Anna de Vries — 30-dniowy plan w 5 obszarach życia.",
    price: 99,
  },
]

export default async function seedBibliaKotowBumps({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  const channels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  if (!channels.length) {
    throw new Error(`[BibliaKotowBumps] Sales channel '${SALES_CHANNEL_NAME}' not found`)
  }
  const salesChannel = channels[0]

  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type"],
  })
  const shippingProfile = profiles.find((p: any) => p.type === "default") || profiles[0]

  const { data: stockLocations } = await query.graph({
    entity: "stock_location",
    fields: ["id", "name"],
  })
  const loc =
    stockLocations.find((l: any) => l.name === STOCK_LOCATION_NAME) || stockLocations[0]

  const results: any[] = []

  for (const bump of BUMPS) {
    const source = await query.graph({
      entity: "product",
      fields: ["id", "thumbnail", "images.url"],
      filters: { handle: bump.sourceHandle },
    })
    const sourceProduct = source.data?.[0]
    if (!sourceProduct) {
      throw new Error(`[BibliaKotowBumps] Source product '${bump.sourceHandle}' not found`)
    }
    const thumbnail = sourceProduct.thumbnail || sourceProduct.images?.[0]?.url || null
    const images = (sourceProduct.images || [])
      .map((image: any) => image?.url)
      .filter(Boolean)
      .map((url: string) => ({ url }))

    const existing = await query.graph({
      entity: "product",
      fields: ["id", "handle", "variants.id", "variants.sku"],
      filters: { handle: bump.handle },
    })

    if (existing.data?.length) {
      const p = existing.data[0]
      const variant = p.variants?.[0]
      if (!variant?.id) throw new Error(`[BibliaKotowBumps] '${bump.handle}' has no variant`)

      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: p.id },
          update: {
            title: bump.title,
            description: bump.description,
            thumbnail,
            ...(images.length ? { images } : {}),
          },
        },
      })
      await updateProductVariantsWorkflow(container).run({
        input: {
          selector: { id: variant.id, product_id: p.id },
          update: {
            title: "Paperback – upsell",
            sku: bump.sku,
            prices: [{ amount: bump.price, currency_code: CURRENCY }],
          },
        },
      })
      logger.info(
        `[BibliaKotowBumps] Normalized ${bump.handle}: product ${p.id}, variant ${variant.id}`
      )
      results.push({
        handle: bump.handle,
        productId: p.id,
        variantId: variant.id,
        sku: bump.sku,
        price: bump.price,
      })
      continue
    }

    const { result } = await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: bump.title,
            description: bump.description,
            handle: bump.handle,
            thumbnail,
            ...(images.length ? { images } : {}),
            weight: 500,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            options: [{ title: "Format", values: ["Paperback"] }],
            variants: [
              {
                title: "Paperback – upsell",
                sku: bump.sku,
                options: { Format: "Paperback" },
                prices: [{ amount: bump.price, currency_code: CURRENCY }],
                manage_inventory: true,
              },
            ],
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })
    const product = result[0]
    logger.info(`[BibliaKotowBumps] Created ${bump.handle}: ${product.id}`)

    const { data: inventoryItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku"],
      filters: { sku: bump.sku },
    })
    if (loc && inventoryItems.length) {
      await createInventoryLevelsWorkflow(container).run({
        input: {
          inventory_levels: inventoryItems.map((item: any) => ({
            inventory_item_id: item.id,
            location_id: loc.id,
            stocked_quantity: 100000,
          })),
        },
      })
    }

    const { data: created } = await query.graph({
      entity: "product",
      fields: ["id", "variants.id"],
      filters: { handle: bump.handle },
    })
    results.push({
      handle: bump.handle,
      productId: created?.[0]?.id,
      variantId: created?.[0]?.variants?.[0]?.id,
      sku: bump.sku,
      price: bump.price,
    })
  }

  logger.info("[BibliaKotowBumps] Done:")
  for (const r of results) {
    logger.info(`  ${r.handle}  variantId=${r.variantId}  sku=${r.sku}  ${r.price} zł`)
  }
  return results
}
