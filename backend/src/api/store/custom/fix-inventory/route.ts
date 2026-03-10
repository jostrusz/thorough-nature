import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

/**
 * POST /store/custom/fix-inventory
 * v3 - Uses workflows only, no direct module calls
 * DELETE THIS ROUTE AFTER USE.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const VERSION = "v3-2026-03-10"

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const remoteLink = req.scope.resolve(ContainerRegistrationKeys.REMOTE_LINK)

    // 1. Find all stock locations via query graph
    const { data: stockLocations } = await query.graph({
      entity: "stock_location",
      fields: ["id", "name"],
    })

    // 2. Find kocici-bible inventory item
    const { data: inventoryItems } = await query.graph({
      entity: "inventory_item",
      fields: ["id", "sku"],
      filters: { sku: ["KOCICI-BIBLE-PB"] },
    })

    if (!inventoryItems.length) {
      res.json({ version: VERSION, success: false, error: "No inventory item for KOCICI-BIBLE-PB", stockLocations })
      return
    }

    const item = inventoryItems[0]
    const results: string[] = []

    // 3. Find all sales channels
    const { data: salesChannels } = await query.graph({
      entity: "sales_channel",
      fields: ["id", "name"],
    })

    // 4. Link ALL stock locations to ALL sales channels
    for (const sc of salesChannels) {
      for (const sl of stockLocations) {
        try {
          await remoteLink.create({
            [Modules.SALES_CHANNEL]: { sales_channel_id: sc.id },
            [Modules.STOCK_LOCATION]: { stock_location_id: sl.id },
          })
          results.push(`Linked SC:${sc.name} → SL:${sl.name}`)
        } catch (e: any) {
          results.push(`SC-SL link exists: ${sc.name} → ${sl.name}`)
        }
      }
    }

    // 5. Create inventory levels using the workflow
    const { createInventoryLevelsWorkflow } = await import("@medusajs/medusa/core-flows")

    for (const sl of stockLocations) {
      try {
        await createInventoryLevelsWorkflow(req.scope).run({
          input: {
            inventory_levels: [{
              location_id: sl.id,
              stocked_quantity: 1000000,
              inventory_item_id: item.id,
            }],
          },
        })
        results.push(`Created level: ${sl.name}`)
      } catch (e: any) {
        results.push(`Level exists/failed ${sl.name}: ${e.message?.substring(0, 80)}`)
      }
    }

    res.json({
      version: VERSION,
      success: true,
      inventoryItem: item.id,
      stockLocations,
      salesChannels: salesChannels.map((sc: any) => ({ id: sc.id, name: sc.name })),
      results,
    })
  } catch (error: any) {
    console.error("[FixInventory] Error:", error.message)
    res.status(500).json({ version: VERSION, success: false, error: error.message })
  }
}
