import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../modules/dextrum"

// GET /admin/dextrum/orders — List all Dextrum order mappings
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any

    const limit = parseInt(req.query.limit as string) || 50
    const offset = parseInt(req.query.offset as string) || 0
    const status = req.query.status as string

    const filters: any = {}
    if (status) {
      filters.delivery_status = status
    }

    const orders = await dextrumService.listDextrumOrderMaps(
      filters,
      { take: limit, skip: offset, order: { created_at: "DESC" } }
    )
    const count = await dextrumService.listDextrumOrderMaps(filters, { select: ["id"] })

    res.json({ orders, count: count.length })
  } catch (error: any) {
    console.error("Dextrum orders list error:", error)
    res.status(500).json({ error: error.message })
  }
}
