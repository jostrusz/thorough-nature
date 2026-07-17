// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../../../modules/dextrum/api-client"

/**
 * GET /admin/dextrum/orders/:id/wms-status — read the order back FROM mySTOCK.
 *
 * Read-only diagnostics. `dextrum_order_map.delivery_status = IMPORTED` only
 * records what our send call believed; it is not proof the warehouse actually
 * has a usable order. This route asks mySTOCK directly, so "is it really in the
 * WMS, and in what state" stops being guesswork.
 *
 * Motivating case (2026-07-17): five Hungarian orders (HU2026-27559-R1 etc.)
 * were IMPORTED with a mystock_order_id, yet invisible in the mySTOCK order
 * list. Re-sending returned "The logical key is not unique" pointing at that
 * very GUID — so the records exist but the warehouse cannot see them.
 *
 * :id = medusa_order_id. Pass ?id=<guid> to read an arbitrary mySTOCK id.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { id: medusaOrderId } = req.params
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any

    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config?.api_url) {
      res.status(400).json({ error: "Dextrum not configured" })
      return
    }

    const maps = await dextrumService.listDextrumOrderMaps(
      { medusa_order_id: medusaOrderId },
      { take: 1 }
    )
    const map = maps[0]

    // Explicit override wins — lets us inspect a GUID whose map row is gone.
    const wmsId = (req.query.id as string) || map?.mystock_order_id
    if (!wmsId) {
      res.status(404).json({
        error: "No mystock_order_id for this order — it was never accepted by the WMS.",
        map: map || null,
      })
      return
    }

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    const ours = map
      ? {
          mystock_order_code: map.mystock_order_code,
          mystock_order_id: map.mystock_order_id,
          delivery_status: map.delivery_status,
          sent_to_wms_at: map.sent_to_wms_at,
          resend_count: map.resend_count,
          retry_count: map.retry_count,
          last_error: map.last_error,
        }
      : null

    try {
      const wms = await client.getOrder(wmsId)
      res.json({ found: true, queried_id: wmsId, ours, wms })
    } catch (err: any) {
      // A failure here is itself the answer: the GUID we stored is not readable.
      res.json({
        found: false,
        queried_id: wmsId,
        ours,
        wms_error: err.message,
      })
    }
  } catch (err: any) {
    console.error(`[Dextrum WMS Status] ${err.message}`)
    res.status(500).json({ error: err.message })
  }
}
