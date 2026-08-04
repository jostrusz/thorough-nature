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
 * Seeds the order-bump upsell product for the macacia-biblia (SK) checkout:
 *   1. "Pusti to, čo ťa ničí – upsell"   25 EUR (regular 32)
 *
 * Same pattern as seed-kocici-bumps.ts: a dedicated product + variant per bump
 * so the discounted price lives on the variant, and the warehouse can tell an
 * order-bump copy apart from a regular sale of the same title.
 *
 * SKU = parent physical barcode + "-2" suffix; Dextrum maps the suffix back to
 * the parent barcode (see api/admin/dextrum/orders/[id]/send/route.ts and
 * jobs/dextrum-order-hold.ts).
 *
 * Slovak market runs on EUR and shares region + warehouse with pusti-to-sk,
 * so no currency conversion is needed — unlike the CZK bumps on kocici-bible.
 *
 * Psí superživot is intentionally NOT seeded here: no Slovak edition exists
 * (only the CZ product PZ7874294876, priced in CZK).
 *
 * Idempotent — safe to re-run (updates existing products in place).
 * Run with: pnpm medusa exec ./src/scripts/seed-macacia-bumps.ts
 */

const SALES_CHANNEL = "Macacia Biblia"
const CURRENCY = "eur"
const WAREHOUSE_MATCH = /pusti to sk/i

const BUMPS = [
  {
    handle: "pusti-to-co-ta-nici-mb",
    sourceHandle: "pusti-to",
    sku: "PTCN6764786297-2",
    title: "Pusti to, čo ťa ničí – upsell",
    description:
      "Order-bump vydanie knihy Pusti to, čo ťa ničí pre checkout Mačacej biblie. Autor Joris de Vries, 290 strán vrátane praktického pracovného zošita — ako zastaviť premýšľanie, upokojiť emócie a nájsť vnútorný pokoj.",
    price: 25,
  },
]

export default async function seedMacaciaBumps({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  const channels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL,
  })
  if (!channels.length) {
    throw new Error(`[MacaciaBumps] Sales channel '${SALES_CHANNEL}' not found`)
  }
  const salesChannel = channels[0]

  const { data: profiles } = await query.graph({
    entity: "shipping_profile",
    fields: ["id", "name", "type"],
  })
  const shippingProfile = profiles.find((p: any) => p.type === "default") || profiles[0]

  const results: any[] = []

  for (const bump of BUMPS) {
    // Source product (thumbnail + gallery)
    const source = await query.graph({
      entity: "product",
      fields: ["id", "thumbnail", "images.url"],
      filters: { handle: bump.sourceHandle },
    })
    const sourceProduct = source.data?.[0]
    if (!sourceProduct) {
      throw new Error(`[MacaciaBumps] Source product '${bump.sourceHandle}' not found`)
    }
    const thumbnail = sourceProduct.thumbnail || sourceProduct.images?.[0]?.url || null
    const images = (sourceProduct.images || [])
      .map((image: any) => image?.url)
      .filter(Boolean)
      .map((url: string) => ({ url }))

    // Existing? → normalize in place
    const existing = await query.graph({
      entity: "product",
      fields: ["id", "handle", "variants.id", "variants.sku"],
      filters: { handle: bump.handle },
    })

    if (existing.data?.length) {
      const p = existing.data[0]
      const variant = p.variants?.[0]
      if (!variant?.id) throw new Error(`[MacaciaBumps] '${bump.handle}' has no variant`)

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
      logger.info(`[MacaciaBumps] Normalized ${bump.handle}: product ${p.id}, variant ${variant.id}`)
      results.push({ handle: bump.handle, productId: p.id, variantId: variant.id, sku: bump.sku, price: bump.price })
      continue
    }

    // Create fresh
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
    logger.info(`[MacaciaBumps] Created ${bump.handle}: ${product.id}`)

    // Inventory level (physical stock is the shared parent book at Dextrum;
    // level here only satisfies manage_inventory)
    const { data: stockLocations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    const loc = stockLocations.find((l: any) => WAREHOUSE_MATCH.test(l.name)) || stockLocations[0]
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
      logger.info(`[MacaciaBumps] Inventory level created at '${loc.name}'`)
    }

    const { data: created } = await query.graph({
      entity: "product",
      fields: ["id", "variants.id"],
      filters: { handle: bump.handle },
    })
    results.push({ handle: bump.handle, productId: created[0].id, variantId: created[0].variants?.[0]?.id, sku: bump.sku, price: bump.price })
  }

  console.log(JSON.stringify(results, null, 2))
}
