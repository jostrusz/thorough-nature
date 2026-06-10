import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../../../modules/dextrum/api-client"

// POST /admin/dextrum/orders/:id/items
// Add one or more brand-new line items to an order that was ALREADY imported
// into the mySTOCK WMS but not yet dispatched (status "Nezahájena").
//
// mySTOCK supports this via PUT /V1/orderIncoming/{id} — a new item is one sent
// WITHOUT an `itemId`. Only works until a shipment has been created in the WMS.
//
// Body: { items: [{ product_code: string, quantity: number, product_name?: string }] }
//   product_code = physical warehouse SKU (e.g. "LLWJK7824627392")
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { id: medusaOrderId } = req.params
    const body = (req.body || {}) as {
      items?: Array<{ product_code?: string; quantity?: number; product_name?: string }>
    }
    const items = Array.isArray(body.items) ? body.items : []

    if (!items.length) {
      res.status(400).json({ error: "No items provided." })
      return
    }
    for (const it of items) {
      if (!it.product_code || !it.quantity || Number(it.quantity) <= 0) {
        res.status(400).json({ error: "Each item needs a product_code and quantity > 0." })
        return
      }
    }

    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any

    // 1. Config
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config) {
      res.status(400).json({ error: "Dextrum not configured" })
      return
    }

    // 2. Order map — must already exist in the WMS
    const maps = await dextrumService.listDextrumOrderMaps(
      { medusa_order_id: medusaOrderId },
      { take: 1 }
    )
    const map = maps[0]
    if (!map?.mystock_order_id) {
      res.status(400).json({
        error: "Order has not been sent to the WMS yet — nothing to add items to.",
      })
      return
    }

    // 3. Guard: WMS rejects updates once a shipment exists. Fail fast with a clear message.
    const status = (map.delivery_status || "").toUpperCase()
    const blocked = ["PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]
    if (blocked.includes(status)) {
      res.status(400).json({
        error: `Cannot add items — order is already ${map.delivery_status} (shipment created in WMS).`,
      })
      return
    }

    // 4. Build unique itemCode/extIsId per added line so they never collide with
    //    the order's original items (numbered /001../00N) or earlier additions.
    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })
    const baseCode = (map.mystock_order_code || "").replace(/-R\d+$/, "")
    let seq = Number(map.metadata?.wms_added_items || 0)
    const wmsItems = items.map((it) => {
      seq += 1
      const code = `${baseCode}/A${seq}`
      return {
        itemCode: code,
        extIsId: code,
        productId: String(it.product_code), // ext. system code (SKU) — no itemId ⇒ new item
        amount: { quantity: Number(it.quantity) },
        warehouseCode: (config.default_warehouse_code || "").trim() || undefined,
        name: it.product_name || undefined,
      }
    })

    // 5. PUT to mySTOCK
    const result = await client.updateOrder(map.mystock_order_id, { items: wmsItems })
    if (result?.errors?.length) {
      res.status(400).json({ error: "mySTOCK rejected the update", details: result.errors })
      return
    }

    // 6. Persist the counter so subsequent adds keep unique itemCodes
    await dextrumService.updateDextrumOrderMaps({
      id: map.id,
      metadata: { ...(map.metadata || {}), wms_added_items: seq },
    })

    console.log(
      `[Dextrum Add Item] ${baseCode}: added ${wmsItems.length} item(s) → ${wmsItems
        .map((i) => `${i.productId} x${i.amount.quantity}`)
        .join(", ")}`
    )

    res.json({
      ok: true,
      mystock_order_id: map.mystock_order_id,
      mystock_order_code: map.mystock_order_code,
      added: wmsItems.map((i) => ({
        itemCode: i.itemCode,
        productId: i.productId,
        quantity: i.amount.quantity,
      })),
      result: result?.data ?? result,
    })
  } catch (error: any) {
    console.error("[Dextrum Add Item] error:", error)
    res.status(500).json({ error: error.message })
  }
}
