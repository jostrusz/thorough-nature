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
 * Seeds the three order-bump upsell products for the kocici-bible checkout:
 *   1. "Pusť to, co tě ničí – upsell"        599 CZK (regular 749)
 *   2. "Život, jaký si zasloužíš – upsell"   599 CZK (regular 749)
 *   3. "Psí superživot – upsell"             499 CZK (regular 550)
 *
 * Mirrors the seed-zivot-upsell pattern: dedicated product + variant per bump
 * so the discounted price lives on the variant (line-items-bundle falls back
 * to variant price for unknown handles). Thumbnail + images are copied from
 * the source products so the covers render in admin AND on the checkout.
 *
 * SKU = parent physical barcode + "-2" suffix; Dextrum maps the suffix back
 * to the parent barcode (see api/admin/dextrum/orders/[id]/send/route.ts and
 * jobs/dextrum-order-hold.ts).
 *
 * Idempotent — safe to re-run (updates existing products in place).
 * Run with: pnpm medusa exec ./src/scripts/seed-kocici-bumps.ts
 */

const BUMPS = [
  {
    handle: "pust-to-co-te-nici-kb",
    sourceHandle: "pust-to-co-te-nici",
    sku: "PTCTN2876287672-2",
    title: "Pusť to, co tě ničí – upsell",
    description:
      "Order-bump vydání knihy Pusť to, co tě ničí pro checkout Kočičí bible. Autor Joris de Vries, 290 stran včetně praktického pracovního sešitu — jak zastavit přemítání, zklidnit emoce a najít vnitřní klid.",
    price: 599,
  },
  {
    handle: "zivot-ktery-si-zasluzis-kb",
    sourceHandle: "zivot-ktery-si-zasluzis",
    sku: "ZJSZ9827982789-2",
    title: "Život, jaký si zasloužíš – upsell",
    description:
      "Order-bump vydání knihy Život, jaký si zasloužíš (LIFE RESET™) pro checkout Kočičí bible. 350 stran, 30denní plán v 5 oblastech života.",
    price: 599,
  },
  {
    handle: "psi-superzivot-kb",
    sourceHandle: "psi-superzivot",
    sku: "PZ7874294876-2",
    title: "Psí superživot – upsell",
    description:
      "Order-bump vydání knihy Psí superživot pro checkout Kočičí bible. Michal Peterka — zdraví, výživa a dlouhověkost vašeho psa.",
    price: 499,
  },
]

export default async function seedKociciBumps({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  const channels = await salesChannelModuleService.listSalesChannels({
    name: "Kocici Bible",
  })
  if (!channels.length) {
    throw new Error("[KociciBumps] Sales channel 'Kocici Bible' not found")
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
      throw new Error(`[KociciBumps] Source product '${bump.sourceHandle}' not found`)
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
      if (!variant?.id) throw new Error(`[KociciBumps] '${bump.handle}' has no variant`)

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
            prices: [{ amount: bump.price, currency_code: "czk" }],
          },
        },
      })
      logger.info(`[KociciBumps] Normalized ${bump.handle}: product ${p.id}, variant ${variant.id}`)
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
                prices: [{ amount: bump.price, currency_code: "czk" }],
                manage_inventory: true,
              },
            ],
            sales_channels: [{ id: salesChannel.id }],
          },
        ],
      },
    })
    const product = result[0]
    logger.info(`[KociciBumps] Created ${bump.handle}: ${product.id}`)

    // Inventory level (physical stock is the shared parent book at Dextrum;
    // level here only satisfies manage_inventory)
    const { data: stockLocations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })
    const loc = stockLocations.find((l: any) => /kocici/i.test(l.name)) || stockLocations[0]
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
    results.push({ handle: bump.handle, productId: created[0].id, variantId: created[0].variants?.[0]?.id, sku: bump.sku, price: bump.price })
  }

  console.log(JSON.stringify(results, null, 2))
}
