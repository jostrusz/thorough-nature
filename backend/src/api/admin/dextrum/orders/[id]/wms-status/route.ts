import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../../../modules/dextrum/api-client"
import { guardControlsEnabled } from "../../../../../../modules/dextrum/controls-flag"

// GET /admin/dextrum/orders/:id/wms-status
// Read the LIVE order state straight from mySTOCK (GET /orderIncoming/{id}),
// not just our local dextrum_order_map mirror. Read-only.
//
// INACTIVE until DEXTRUM_CONTROLS_ENABLED=true — returns 503 before touching WMS.
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!guardControlsEnabled(res)) return
  try {
    const { id: medusaOrderId } = req.params
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any

    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config) {
      res.status(400).json({ error: "Dextrum not configured" })
      return
    }

    const maps = await dextrumService.listDextrumOrderMaps({ medusa_order_id: medusaOrderId }, { take: 1 })
    const map = maps[0]
    if (!map?.mystock_order_id) {
      res.status(400).json({ error: "Order has not been sent to the WMS yet." })
      return
    }

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })
    const wms = await client.getOrder(map.mystock_order_id)

    res.json({
      ok: true,
      mystock_order_id: map.mystock_order_id,
      mystock_order_code: map.mystock_order_code,
      local_status: map.delivery_status,
      wms,
    })
  } catch (error: any) {
    console.error("[Dextrum WMS Status] error:", error)
    res.status(500).json({ error: error.message, message: error.message })
  }
}
