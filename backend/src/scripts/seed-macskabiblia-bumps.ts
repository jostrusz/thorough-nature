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
 * Seeds the order-bump upsell product for the macskabiblia checkout:
 *   "Engedd el, ami tönkretesz – upsell"   8 990 Ft (regular 10 999)
 *
 * Hungarian counterpart of seed-kocici-bumps / seed-biblia-kotow-bumps: a
 * dedicated product + variant so the discounted price lives on the variant
 * (line-items-bundle falls back to the variant price for unknown handles).
 * Thumbnail + gallery are copied from the source product.
 *
 * SKU = parent physical barcode + "-MB" (macskabiblia). The plain "-2" suffix
 * convention is avoided here on purpose: those keys are already crowded across
 * funnels, and a project-scoped suffix makes the owner obvious at a glance.
 * Dextrum maps it back to the parent barcode EEAT89789272462 — see
 * api/admin/dextrum/orders/[id]/send/route.ts and jobs/dextrum-order-hold.ts.
 *
 * Stock lives on the shared "Engedd El Warehouse" — Macskabiblia has no
 * warehouse of its own; the level here only satisfies manage_inventory, the
 * physical stock is Dextrum's.
 *
 * Idempotent — safe to re-run.
 * Run with: pnpm medusa exec ./src/scripts/seed-macskabiblia-bumps.ts
 */

const SALES_CHANNEL_NAME = "Macskabiblia"
const STOCK_LOCATION_NAME = "Engedd El Warehouse"
const CURRENCY = "huf"

const BUMPS = [
  {
    handle: "engedd-el-ami-tonkretesz-mb",
    sourceHandle: "engedd-el-ami-tonkretesz",
    sku: "EEAT89789272462-MB",
    title: "Engedd el, ami tönkretesz – upsell",
    description:
      "Order-bump kiadás az Engedd el, ami tönkretesz című könyvből a Macskabiblia pénztárához. Joris de Vries — hogyan állítsd meg a fejedben pörgő gondolatokat, csillapítsd az érzelmeidet és találd meg a belső nyugalmat.",
    price: 8990,
  },
]

export default async function seedMacskabibliaBumps({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const salesChannelModuleService = container.resolve(Modules.SALES_CHANNEL)

  const channels = await salesChannelModuleService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })
  if (!channels.length) {
    throw new Error(`[MacskabibliaBumps] Sales channel '${SALES_CHANNEL_NAME}' not found`)
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
      throw new Error(`[MacskabibliaBumps] Source product '${bump.sourceHandle}' not found`)
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
      if (!variant?.id) throw new Error(`[MacskabibliaBumps] '${bump.handle}' has no variant`)

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
            title: "Puhakötés – upsell",
            sku: bump.sku,
            prices: [{ amount: bump.price, currency_code: CURRENCY }],
          },
        },
      })
      logger.info(
        `[MacskabibliaBumps] Normalized ${bump.handle}: product ${p.id}, variant ${variant.id}`
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
                title: "Puhakötés – upsell",
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
    logger.info(`[MacskabibliaBumps] Created ${bump.handle}: ${product.id}`)

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

  logger.info("[MacskabibliaBumps] Done:")
  for (const r of results) {
    logger.info(`  ${r.handle}  variantId=${r.variantId}  sku=${r.sku}  ${r.price} Ft`)
  }
  return results
}
