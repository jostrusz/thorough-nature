import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../../../modules/dextrum/api-client"
import { guardControlsEnabled } from "../../../../../../modules/dextrum/controls-flag"

// POST /admin/dextrum/orders/:id/cancel
// Cancel an order in the mySTOCK WMS (DELETE /orderIncoming/{id}).
// mySTOCK only allows this while the order is still "Nezahájena" — once a
// shipment exists (DISPATCHED etc.) the WMS locks it.
//
// INACTIVE until DEXTRUM_CONTROLS_ENABLED=true — returns 503 before touching WMS.
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
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
      res.status(400).json({ error: "Order has not been sent to the WMS yet — nothing to cancel." })
      return
    }

    // Guard: WMS rejects deletes once a shipment exists. Fail fast, clear message.
    const status = (map.delivery_status || "").toUpperCase()
    const blocked = ["PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]
    if (blocked.includes(status)) {
      res.status(400).json({
        error: `Nelze zrušit — objednávka je už ${map.delivery_status} (expedice vytvořena ve WMS).`,
        message: `Nelze zrušit — objednávka je už ${map.delivery_status} (expedice vytvořena ve WMS).`,
      })
      return
    }

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })
    await client.cancelOrder(map.mystock_order_id)

    await dextrumService.updateDextrumOrderMaps({
      id: map.id,
      delivery_status: "CANCELLED",
      delivery_status_updated_at: new Date().toISOString(),
      metadata: { ...(map.metadata || {}), cancelled_via_admin_at: new Date().toISOString() },
    })

    console.log(`[Dextrum Cancel] ${map.mystock_order_code} cancelled in WMS`)
    res.json({ ok: true, mystock_order_code: map.mystock_order_code, delivery_status: "CANCELLED" })
  } catch (error: any) {
    console.error("[Dextrum Cancel] error:", error)
    res.status(500).json({ error: error.message, message: error.message })
  }
}
