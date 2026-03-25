import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../modules/dextrum/api-client"

/**
 * Temporary debug endpoint to explore mySTOCK API and event logs.
 * GET /admin/dextrum/debug?path=/aboutMe/
 * GET /admin/dextrum/debug?path=/stockCard/1001/
 * GET /admin/dextrum/debug?mode=events&event_type=12&limit=5
 * GET /admin/dextrum/debug?mode=events&document_code=BE2026-130
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const mode = req.query.mode as string

    // Event logs mode — read stored webhook events from DB
    if (mode === "events") {
      const filters: any = {}
      if (req.query.event_type) filters.event_type = req.query.event_type
      if (req.query.document_code) filters.document_code = req.query.document_code
      if (req.query.status) filters.status = req.query.status
      const limit = parseInt(req.query.limit as string) || 20
      const events = await dextrumService.listDextrumEventLogs(filters, {
        take: limit,
        order: { created_at: "DESC" },
      })
      res.json({ count: events.length, events })
      return
    }

    // Order maps mode — read order matching data
    if (mode === "orders") {
      const filters: any = {}
      if (req.query.order_code) filters.mystock_order_code = req.query.order_code
      const limit = parseInt(req.query.limit as string) || 20
      const maps = await dextrumService.listDextrumOrderMaps(filters, {
        take: limit,
        order: { created_at: "DESC" },
      })
      res.json({ count: maps.length, orders: maps })
      return
    }

    // Default: mySTOCK API proxy
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]

    if (!config) {
      res.status(400).json({ error: "No Dextrum configuration found" })
      return
    }

    const apiPath = (req.query.path as string) || "/aboutMe/"

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    const result = await client.request("GET", apiPath)
    res.json({ path: apiPath, result })
  } catch (error: any) {
    console.error("Dextrum debug error:", error)
    res.status(500).json({ error: error.message, path: req.query.path })
  }
}

/**
 * POST /admin/dextrum/debug — Bulk fix order statuses and tracking
 * Body: { fixes: [{ id: "orderMapId", delivery_status: "DELIVERED", tracking_number: "123" }] }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const { fixes } = req.body as any
    if (!fixes || !Array.isArray(fixes)) {
      res.status(400).json({ error: "Missing fixes array" })
      return
    }
    const results = []
    for (const fix of fixes) {
      try {
        const updateData: any = {}
        if (fix.delivery_status) updateData.delivery_status = fix.delivery_status
        if (fix.tracking_number) updateData.tracking_number = fix.tracking_number
        if (fix.carrier_name) updateData.carrier_name = fix.carrier_name
        if (fix.delivery_status === "DELIVERED") updateData.delivered_at = new Date().toISOString()
        if (fix.delivery_status === "DISPATCHED") updateData.dispatched_at = new Date().toISOString()
        updateData.delivery_status_updated_at = new Date().toISOString()
        await dextrumService.updateDextrumOrderMaps({ id: fix.id, ...updateData })
        results.push({ id: fix.id, status: "ok" })
      } catch (err: any) {
        results.push({ id: fix.id, status: "error", message: err.message })
      }
    }
    res.json({ fixed: results.length, results })
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
