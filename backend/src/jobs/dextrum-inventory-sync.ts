import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"
import { MyStockApiClient } from "../modules/dextrum/api-client"

/**
 * Dextrum Inventory Sync Job
 * Runs every 15 minutes (configurable) — pulls stock levels from mySTOCK
 * Stock Card API and updates Medusa inventory quantities.
 */
export default async function dextrumInventorySync(container: MedusaContainer) {
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any
  const query = container.resolve("query") as any

  try {
    // 1. Get config
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config?.enabled || !config.inventory_sync_enabled || !config.api_url) return

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    // 2. Fetch stock card
    const warehouseCode = config.default_warehouse_code || "MAIN"
    const stockCards = await client.getStockCard(warehouseCode)
    if (!Array.isArray(stockCards) || stockCards.length === 0) return

    // 3. Get all Medusa variants for SKU matching
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "sku", "product.id", "product.title"],
      pagination: { take: 5000 },
    })

    const variantBySku = new Map<string, any>()
    for (const v of variants) {
      if (v.sku) variantBySku.set(v.sku, v)
    }

    // 4. Process
    let total = 0
    let updated = 0
    const now = new Date().toISOString()

    for (const card of stockCards) {
      const sku = card.productCode || card.code
      if (!sku) continue
      total++

      const availableStock = Number(card.availableStock ?? card.available ?? 0)
      const physicalStock = Number(card.physicalStock ?? card.physical ?? 0)
      const reservedStock = Number(card.reservedStock ?? card.reserved ?? 0)
      const blockedStock = Number(card.blockedStock ?? card.blocked ?? 0)

      const existing = await dextrumService.listDextrumInventorys({ sku }, { take: 1 })
      const variant = variantBySku.get(sku)
      const previousAvailable = existing[0]?.available_stock ?? 0
      const stockChanged = previousAvailable !== availableStock

      const data: any = {
        sku,
        product_name: card.productName || variant?.product?.title || sku,
        available_stock: availableStock,
        physical_stock: physicalStock,
        reserved_stock: reservedStock,
        blocked_stock: blockedStock,
        warehouse_code: warehouseCode,
        last_synced_at: now,
        stock_changed: stockChanged,
        previous_available: previousAvailable,
        medusa_variant_id: variant?.id || existing[0]?.medusa_variant_id || null,
        medusa_product_id: variant?.product?.id || existing[0]?.medusa_product_id || null,
      }

      if (existing[0]) {
        await dextrumService.updateDextrumInventorys(existing[0].id, data)
      } else {
        await dextrumService.createDextrumInventorys(data)
      }

      if (stockChanged) {
        updated++

        // Update Medusa inventory if variant found
        if (variant?.id) {
          try {
            const inventoryService = container.resolve(Modules.INVENTORY) as any
            const items = await inventoryService.listInventoryItems({ sku })
            if (items[0]) {
              const levels = await inventoryService.listInventoryLevels({
                inventory_item_id: items[0].id,
              })
              if (levels[0]) {
                await inventoryService.updateInventoryLevels(levels[0].id, {
                  stocked_quantity: physicalStock,
                })
              }
            }
          } catch (err: any) {
            console.warn(`[Dextrum Inventory Sync] Failed to update Medusa inventory for ${sku}:`, err.message)
          }
        }
      }
    }

    // 5. Update config
    await dextrumService.updateDextrumConfigs(config.id, {
      last_inventory_sync: now,
      last_inventory_sync_products: total,
      last_inventory_sync_updated: updated,
    })

    if (updated > 0) {
      console.log(`[Dextrum Inventory Sync] Synced ${total} products, ${updated} changed`)
    }
  } catch (error: any) {
    console.error("[Dextrum Inventory Sync] Job failed:", error.message)
  }
}

export const config = {
  name: "dextrum-inventory-sync",
  schedule: "*/15 * * * *",
}
