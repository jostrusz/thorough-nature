import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { createInventoryLevelsWorkflow } from "@medusajs/medusa/core-flows"

/**
 * POST /store/custom/fix-inventory
 * Fix missing inventory levels for kocici-bible on production.
 * DELETE THIS ROUTE AFTER USE.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const stockLocationModule = req.scope.resolve(Modules.STOCK_LOCATION)
    const inventoryModule = req.scope.resolve(Modules.INVENTORY)

    // 1. Find all stock locations
    const stockLocations = await stockLocationModule.listStockLocations({})
    console.log("[FixInventory] Stock locations:", JSON.stringify(stockLocations.map((sl: any) => ({ id: sl.id, name: sl.name }))))

    // 2. Find kocici-bible inventory item
    const { data: inventoryItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku", "inventory_levels.*"],
      filters: { sku: ["KOCICI-BIBLE-PB"] },
    })

    console.log("[FixInventory] Inventory items:", JSON.stringify(inventoryItems))

    if (!inventoryItems.length) {
      res.json({ success: false, error: "No inventory item found for KOCICI-BIBLE-PB" })
      return
    }

    const item = inventoryItems[0]
    const existingLevels = item.inventory_levels || []

    // 3. Find which stock locations are missing
    const existingLocationIds = existingLevels.map((l: any) => l.location_id)
    const missingLocations = stockLocations.filter((sl: any) => !existingLocationIds.includes(sl.id))

    if (missingLocations.length === 0) {
      // Check if the issue is sales channel <-> stock location link
      const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)

      // Check sales channel links
      const { data: salesChannels } = await query.graph({
        entity: "sales_channel",
        fields: ["id", "name"],
        filters: { name: "Psi Superzivot" },
      })

      res.json({
        success: true,
        message: "All stock locations already have inventory levels",
        inventoryItem: item.id,
        existingLevels: existingLevels.map((l: any) => ({
          location_id: l.location_id,
          stocked_quantity: l.stocked_quantity,
        })),
        stockLocations: stockLocations.map((sl: any) => ({ id: sl.id, name: sl.name })),
        salesChannels: salesChannels.map((sc: any) => ({ id: sc.id, name: sc.name })),
      })
      return
    }

    // 4. Create inventory levels for missing locations
    await createInventoryLevelsWorkflow(req.scope).run({
      input: {
        inventory_levels: missingLocations.map((sl: any) => ({
          location_id: sl.id,
          stocked_quantity: 1000000,
          inventory_item_id: item.id,
        })),
      },
    })

    // 5. Also link stock locations to the sales channel if not already linked
    const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)
    const { data: salesChannels } = await query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
      filters: { name: "Psi Superzivot" },
    })

    if (salesChannels.length) {
      const scId = salesChannels[0].id
      for (const sl of stockLocations) {
        try {
          await remoteLink.create({
            [Modules.SALES_CHANNEL]: { sales_channel_id: scId },
            [Modules.STOCK_LOCATION]: { stock_location_id: sl.id },
          })
          console.log(`[FixInventory] Linked sales channel ${scId} to stock location ${sl.id}`)
        } catch (e: any) {
          // Link might already exist
          console.log(`[FixInventory] Link already exists or failed: ${e.message}`)
        }
      }
    }

    res.json({
      success: true,
      inventoryItem: item.id,
      levelsCreated: missingLocations.map((sl: any) => sl.id),
      stockLocations: stockLocations.map((sl: any) => ({ id: sl.id, name: sl.name })),
    })
  } catch (error: any) {
    console.error("[FixInventory] Error:", error.message)
    res.status(500).json({ success: false, error: error.message })
  }
}
