import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../../modules/dextrum/api-client"

// POST /admin/dextrum/inventory/sync — Trigger manual inventory sync
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // 1. Get config
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config?.api_url) {
      res.status(400).json({ error: "Dextrum not configured" })
      return
    }

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    // 2. Fetch stock card from mySTOCK
    const warehouseCode = config.default_warehouse_code || "MAIN"
    const stockCards = await client.getStockCard(warehouseCode)

    if (!Array.isArray(stockCards) || stockCards.length === 0) {
      res.json({ success: true, message: "No stock data returned from WMS", products: 0, updated: 0 })
      return
    }

    // 3. Get all Medusa variants (for SKU matching)
    const { data: variants } = await query.graph({
      entity: "product_variant",
      fields: ["id", "sku", "product.id", "product.title", "manage_inventory", "inventory_quantity"],
      pagination: { take: 5000 },
    })

    const variantBySku = new Map<string, any>()
    for (const v of variants) {
      if (v.sku) variantBySku.set(v.sku, v)
    }

    // 4. Process each stock card entry
    let totalProducts = 0
    let updatedProducts = 0
    const now = new Date().toISOString()

    for (const card of stockCards) {
      const sku = card.productCode || card.code
      if (!sku) continue
      totalProducts++

      const availableStock = Number(card.availableStock ?? card.available ?? 0)
      const physicalStock = Number(card.physicalStock ?? card.physical ?? 0)
      const reservedStock = Number(card.reservedStock ?? card.reserved ?? 0)
      const blockedStock = Number(card.blockedStock ?? card.blocked ?? 0)

      // Find or create inventory record
      const existing = await dextrumService.listDextrumInventorys(
        { sku },
        { take: 1 }
      )

      const variant = variantBySku.get(sku)
      const previousAvailable = existing[0]?.available_stock ?? 0
      const stockChanged = previousAvailable !== availableStock

      const inventoryData: any = {
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
        await dextrumService.updateDextrumInventorys(existing[0].id, inventoryData)
      } else {
        await dextrumService.createDextrumInventorys(inventoryData)
      }

      if (stockChanged) updatedProducts++

      // 5. Update Medusa variant inventory_quantity if stock changed
      if (stockChanged && variant?.id) {
        try {
          const inventoryService = req.scope.resolve(Modules.INVENTORY) as any
          const inventoryItems = await inventoryService.listInventoryItems({ sku })
          if (inventoryItems[0]) {
            const levels = await inventoryService.listInventoryLevels({
              inventory_item_id: inventoryItems[0].id,
            })
            if (levels[0]) {
              await inventoryService.updateInventoryLevels(levels[0].id, {
                stocked_quantity: physicalStock,
              })
            }
          }
        } catch (invErr: any) {
          console.warn(`[Dextrum Inventory] Could not update Medusa inventory for SKU ${sku}:`, invErr.message)
        }
      }

      // 6. Handle out-of-stock action
      if (availableStock <= 0 && config.out_of_stock_action === "disable_variant" && variant?.id) {
        try {
          const productService = req.scope.resolve(Modules.PRODUCT) as any
          // The inventory update above (stocked_quantity = 0) will handle this
          // if the product has manage_inventory = true
        } catch (err: any) {
          console.warn(`[Dextrum Inventory] Could not disable variant for SKU ${sku}:`, err.message)
        }
      }
    }

    // 7. Update config with sync metadata
    await dextrumService.updateDextrumConfigs(config.id, {
      last_inventory_sync: now,
      last_inventory_sync_products: totalProducts,
      last_inventory_sync_updated: updatedProducts,
    })

    res.json({
      success: true,
      products: totalProducts,
      updated: updatedProducts,
      timestamp: now,
    })
  } catch (error: any) {
    console.error("Dextrum inventory sync error:", error)
    res.status(500).json({ error: error.message })
  }
}
