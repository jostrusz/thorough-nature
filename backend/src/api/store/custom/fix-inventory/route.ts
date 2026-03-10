import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * POST /store/custom/fix-inventory
 * Fix missing inventory levels + sales channel links for kocici-bible.
 * DELETE THIS ROUTE AFTER USE.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const stockLocationModule = req.scope.resolve(Modules.STOCK_LOCATION)
    const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
    const inventoryModule = req.scope.resolve(Modules.INVENTORY)

    // 1. Find all stock locations
    const stockLocations = await stockLocationModule.listStockLocations({})
    const locInfo = stockLocations.map((sl: any) => ({ id: sl.id, name: sl.name }))

    // 2. Find kocici-bible inventory item by SKU
    const { data: inventoryItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku"],
      filters: { sku: ["KOCICI-BIBLE-PB"] },
    })

    if (!inventoryItems.length) {
      res.json({ success: false, error: "No inventory item found for KOCICI-BIBLE-PB", stockLocations: locInfo })
      return
    }

    const item = inventoryItems[0]
    const results: string[] = []

    // 3. Create inventory levels at ALL stock locations (skip if exists)
    for (const sl of stockLocations) {
      try {
        await inventoryModule.createInventoryLevels([{
          inventory_item_id: item.id,
          location_id: sl.id,
          stocked_quantity: 1000000,
        }])
        results.push(`Created inventory level at ${sl.name} (${sl.id})`)
      } catch (e: any) {
        results.push(`Skipped ${sl.name} (${sl.id}): ${e.message?.substring(0, 80)}`)
      }
    }

    // 4. Find "Psi Superzivot" sales channel
    const { data: salesChannels } = await query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
    })

    // 5. Link ALL stock locations to ALL sales channels
    for (const sc of salesChannels) {
      for (const sl of stockLocations) {
        try {
          await remoteLink.create({
            [Modules.SALES_CHANNEL]: { sales_channel_id: sc.id },
            [Modules.STOCK_LOCATION]: { stock_location_id: sl.id },
          })
          results.push(`Linked SC ${sc.name} → SL ${sl.name}`)
        } catch (e: any) {
          results.push(`Link ${sc.name} → ${sl.name}: ${e.message?.substring(0, 60)}`)
        }
      }
    }

    res.json({
      success: true,
      inventoryItem: item.id,
      stockLocations: locInfo,
      salesChannels: salesChannels.map((sc: any) => ({ id: sc.id, name: sc.name })),
      results,
    })
  } catch (error: any) {
    console.error("[FixInventory] Error:", error.message)
    res.status(500).json({ success: false, error: error.message })
  }
}
