import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { DEXTRUM_MODULE } from "../../../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../../../modules/dextrum/api-client"
import { guardControlsEnabled } from "../../../../../../modules/dextrum/controls-flag"

// POST /admin/dextrum/orders/:id/edit
// Modify a WMS order that has NOT been dispatched yet (status "Nezahájena") via
// PUT /orderIncoming/{id}. Sends ONLY the elements provided.
//
// Body (all optional):
//   address:          { first_name, last_name, street, city, zip, country, phone, email, company }
//   pickup_place_code: string   (change / set the pickup point)
//   note:             string
//   items:            [{ item_id?, product_code?, quantity, name? }]
//                       - item_id + quantity        → change qty
//                       - item_id + quantity = 0    → remove item
//                       - product_code (no item_id) → add new item
//
// INACTIVE until DEXTRUM_CONTROLS_ENABLED=true — returns 503 before touching WMS.
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!guardControlsEnabled(res)) return
  try {
    const { id: medusaOrderId } = req.params
    const body = (req.body || {}) as {
      address?: Record<string, any>
      pickup_place_code?: string
      note?: string
      items?: Array<{ item_id?: string; product_code?: string; quantity?: number; name?: string }>
    }

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
      res.status(400).json({ error: "Order has not been sent to the WMS yet — nothing to edit." })
      return
    }

    // Guard: WMS rejects edits once a shipment exists.
    const status = (map.delivery_status || "").toUpperCase()
    const blocked = ["PACKED", "DISPATCHED", "IN_TRANSIT", "DELIVERED", "CANCELLED"]
    if (blocked.includes(status)) {
      res.status(400).json({
        error: `Nelze editovat — objednávka je už ${map.delivery_status} (expedice vytvořena ve WMS).`,
        message: `Nelze editovat — objednávka je už ${map.delivery_status} (expedice vytvořena ve WMS).`,
      })
      return
    }

    // Build the mySTOCK PUT body — only the elements the caller wants to change.
    const wmsBody: Record<string, any> = {}

    if (body.address || body.pickup_place_code) {
      const a = body.address || {}
      const party: Record<string, any> = {}
      if (a.first_name !== undefined) party.firstName = a.first_name
      if (a.last_name !== undefined) party.lastName = a.last_name
      if (a.street !== undefined) party.street = a.street
      if (a.city !== undefined) party.city = a.city
      if (a.zip !== undefined) party.zip = a.zip
      if (a.country !== undefined) party.country = a.country
      if (a.phone !== undefined) party.phone = a.phone
      if (a.email !== undefined) party.email = a.email
      if (a.company !== undefined) party.company = a.company
      if (body.pickup_place_code !== undefined) party.pickupPlaceCode = body.pickup_place_code
      wmsBody.partyIdentification = party
    }

    if (body.note !== undefined) wmsBody.note = body.note

    if (Array.isArray(body.items) && body.items.length) {
      const baseCode = (map.mystock_order_code || "").replace(/-R\d+$/, "")
      let seq = Number((map.metadata as any)?.wms_added_items || 0)
      wmsBody.items = body.items.map((it) => {
        if (it.item_id) {
          // change / remove existing item
          return { itemId: it.item_id, amount: { quantity: Number(it.quantity ?? 0) } }
        }
        // add new item
        seq += 1
        const code = `${baseCode}/A${seq}`
        return {
          itemCode: code,
          extIsId: code,
          productId: String(it.product_code),
          amount: { quantity: Number(it.quantity ?? 1) },
          warehouseCode: (config.default_warehouse_code || "").trim() || undefined,
          name: it.name || undefined,
        }
      })
      wmsBody.__nextSeq = seq // consumed below, stripped before send
    }

    if (Object.keys(wmsBody).filter((k) => k !== "__nextSeq").length === 0) {
      res.status(400).json({ error: "Nic k úpravě — pošli address, pickup_place_code, note nebo items." })
      return
    }

    const nextSeq = wmsBody.__nextSeq
    delete wmsBody.__nextSeq

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })
    const result = await client.updateOrder(map.mystock_order_id, wmsBody)
    if (result?.errors?.length) {
      res.status(400).json({ error: "mySTOCK edit odmítnut", message: "mySTOCK edit odmítnut", details: result.errors })
      return
    }

    const newMeta: Record<string, any> = { ...(map.metadata || {}), edited_via_admin_at: new Date().toISOString() }
    if (nextSeq !== undefined) newMeta.wms_added_items = nextSeq
    await dextrumService.updateDextrumOrderMaps({ id: map.id, metadata: newMeta })

    console.log(`[Dextrum Edit] ${map.mystock_order_code} updated:`, Object.keys(wmsBody).join(", "))
    res.json({ ok: true, mystock_order_code: map.mystock_order_code, changed: Object.keys(wmsBody), result: result?.data ?? result })
  } catch (error: any) {
    console.error("[Dextrum Edit] error:", error)
    res.status(500).json({ error: error.message, message: error.message })
  }
}
