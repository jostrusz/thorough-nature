import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../modules/dextrum"

// GET /admin/dextrum/inventory — List all inventory levels
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any

    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0
    const search = (req.query.q as string) || ""
    const lowStock = req.query.low_stock === "true"

    let items = await dextrumService.listDextrumInventorys(
      {},
      { take: limit, skip: offset, order: { sku: "ASC" } }
    )

    // Filter by search
    if (search) {
      const q = search.toLowerCase()
      items = items.filter((i: any) =>
        i.sku?.toLowerCase().includes(q) ||
        i.product_name?.toLowerCase().includes(q)
      )
    }

    // Filter low stock only
    if (lowStock) {
      items = items.filter((i: any) => i.available_stock <= (i.metadata?.low_threshold || 10))
    }

    // Get config for thresholds
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]

    // Add stock_status to each item
    const enriched = items.map((item: any) => {
      const lowThreshold = config?.low_stock_threshold || 10
      const criticalThreshold = config?.critical_stock_threshold || 3
      let stock_status = "ok"
      if (item.available_stock <= 0) stock_status = "out_of_stock"
      else if (item.available_stock <= criticalThreshold) stock_status = "critical"
      else if (item.available_stock <= lowThreshold) stock_status = "low"
      return { ...item, stock_status }
    })

    res.json({
      inventory: enriched,
      count: enriched.length,
      last_sync: config?.last_inventory_sync || null,
      last_sync_products: config?.last_inventory_sync_products || 0,
      last_sync_updated: config?.last_inventory_sync_updated || 0,
    })
  } catch (error: any) {
    console.error("Dextrum inventory list error:", error)
    res.status(500).json({ error: error.message })
  }
}
