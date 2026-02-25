import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../../../modules/dextrum"

// ═══════════════════════════════════════════
// WEBHOOK EVENT → DELIVERY STATUS MAPPING
// ═══════════════════════════════════════════
const EVENT_STATUS_MAP: Record<string, string> = {
  // Event 7 (order processing)
  "7_1": "IMPORTED",
  "7_2": "PROCESSED",
  "7_3": "PROCESSED",

  // Event 12 (despatch advice) = shipped
  "12": "DISPATCHED",

  // Event 26 (label printed) = packed
  "26": "PACKED",

  // Event 28 (partial pick)
  "28": "PARTIALLY_PICKED",

  // Event 29 (carrier status update)
  "29_transit": "IN_TRANSIT",
  "29_delivered": "DELIVERED",

  // Event 20 (order cancelled)
  "20": "CANCELLED",

  // Event 34 (allocation issue)
  "34": "ALLOCATION_ISSUE",

  // Event 33 (stock level change)
  "33": "STOCK_CHANGE",
}

// POST /webhooks/mystock — Receive mySTOCK webhook events
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const event = req.body as any

    if (!event || !event.eventId) {
      res.status(400).json({ error: "Invalid event payload" })
      return
    }

    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const orderModuleService = req.scope.resolve(Modules.ORDER) as any

    // 1. Deduplicate by eventId
    const existingEvents = await dextrumService.listDextrumEventLogs(
      { event_id: event.eventId },
      { take: 1 }
    )
    if (existingEvents[0]) {
      res.json({ ok: true, message: "Event already processed" })
      return
    }

    // 2. Find the Medusa order by documentId or documentCode
    const documentId = event.documentId || event.data?.documentId
    const documentCode = event.documentCode || event.data?.documentCode
    const eventType = String(event.eventType || event.type || "")
    const eventSubtype = String(event.eventSubtype || event.subtype || "")

    let orderMap = null
    if (documentId) {
      const maps = await dextrumService.listDextrumOrderMaps(
        { mystock_order_id: documentId },
        { take: 1 }
      )
      orderMap = maps[0]
    }
    if (!orderMap && documentCode) {
      const maps = await dextrumService.listDextrumOrderMaps(
        { mystock_order_code: documentCode },
        { take: 1 }
      )
      orderMap = maps[0]
    }

    // 3. Determine new delivery status
    let newStatus = ""
    const key = eventSubtype ? `${eventType}_${eventSubtype}` : eventType

    if (EVENT_STATUS_MAP[key]) {
      newStatus = EVENT_STATUS_MAP[key]
    } else if (EVENT_STATUS_MAP[eventType]) {
      newStatus = EVENT_STATUS_MAP[eventType]
    }

    // Special handling for Event 29 (carrier updates)
    if (eventType === "29") {
      const carrierStatus = (event.data?.status || event.status || "").toLowerCase()
      if (carrierStatus === "delivered" || carrierStatus === "doručeno") {
        newStatus = "DELIVERED"
      } else {
        newStatus = "IN_TRANSIT"
      }
    }

    const previousStatus = orderMap?.delivery_status || null
    const now = new Date().toISOString()

    // 4. Update dextrum_order_map
    if (orderMap && newStatus) {
      const updateData: any = {
        delivery_status: newStatus,
        delivery_status_updated_at: now,
      }

      // Extract tracking info from event
      if (event.data?.trackingNumber || event.trackingNumber) {
        updateData.tracking_number = event.data?.trackingNumber || event.trackingNumber
      }
      if (event.data?.trackingUrl || event.trackingUrl) {
        updateData.tracking_url = event.data?.trackingUrl || event.trackingUrl
      }
      if (event.data?.carrierName || event.carrierName) {
        updateData.carrier_name = event.data?.carrierName || event.carrierName
      }
      if (newStatus === "DISPATCHED") {
        updateData.dispatched_at = now
      }
      if (newStatus === "DELIVERED") {
        updateData.delivered_at = now
      }

      await dextrumService.updateDextrumOrderMaps(orderMap.id, updateData)

      // 5. Also update Medusa order metadata + auto-fulfill on DISPATCHED
      try {
        const queryService = req.scope.resolve("query") as any
        const { data: [order] } = await queryService.graph({
          entity: "order",
          fields: ["id", "metadata", "items.*", "fulfillments.*"],
          filters: { id: orderMap.medusa_order_id },
        })
        if (order) {
          const meta = (order as any).metadata || {}
          const timelineEntry = {
            type: "dextrum",
            status: newStatus,
            date: now,
            detail: event.data?.description || `Status: ${newStatus}`,
            tracking_number: updateData.tracking_number || meta.dextrum_tracking_number,
          }
          const dextrumTimeline = meta.dextrum_timeline || []
          dextrumTimeline.push(timelineEntry)

          await orderModuleService.updateOrders(orderMap.medusa_order_id, {
            metadata: {
              ...meta,
              dextrum_status: newStatus,
              dextrum_status_updated_at: now,
              dextrum_tracking_number: updateData.tracking_number || meta.dextrum_tracking_number,
              dextrum_tracking_url: updateData.tracking_url || meta.dextrum_tracking_url,
              dextrum_carrier: updateData.carrier_name || meta.dextrum_carrier,
              dextrum_timeline: dextrumTimeline,
            },
          })

          // Auto-fulfill on DISPATCHED — mark order as fulfilled with tracking
          if (newStatus === "DISPATCHED") {
            try {
              const existingFulfillments = (order as any).fulfillments || []
              const alreadyFulfilled = existingFulfillments.length > 0

              if (!alreadyFulfilled) {
                const fulfillmentModuleService = req.scope.resolve(Modules.FULFILLMENT) as any
                const items = ((order as any).items || []).map((item: any) => ({
                  id: item.id,
                  quantity: item.quantity || 1,
                }))

                if (items.length > 0) {
                  await orderModuleService.createFulfillment({
                    order_id: orderMap.medusa_order_id,
                    items,
                    metadata: {
                      tracking_number: updateData.tracking_number || null,
                      tracking_url: updateData.tracking_url || null,
                      carrier: updateData.carrier_name || null,
                      source: "dextrum_wms",
                    },
                  })
                  console.log(`[Webhook] Auto-fulfilled order ${orderMap.medusa_order_id} on DISPATCHED`)
                }
              }
            } catch (fulfillErr: any) {
              console.error(`[Webhook] Auto-fulfill failed for ${orderMap.medusa_order_id}:`, fulfillErr.message)
            }
          }
        }
      } catch (err: any) {
        console.error("Failed to update Medusa order metadata:", err.message)
      }
    }

    // 5b. Handle stock change events
    if (eventType === "33" || newStatus === "STOCK_CHANGE") {
      const productCode = event.data?.productCode || event.productCode
      if (productCode) {
        try {
          const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
          const config = configs[0]
          if (config?.api_url) {
            const { MyStockApiClient } = await import("../../../modules/dextrum/api-client.js")
            const client = new MyStockApiClient({
              apiUrl: config.api_url,
              username: config.api_username,
              password: config.api_password,
            })
            const warehouseCode = config.default_warehouse_code || "MAIN"
            const stockCards = await client.getStockCard(warehouseCode, productCode)
            if (stockCards[0]) {
              const card = stockCards[0]
              const existing = await dextrumService.listDextrumInventorys(
                { sku: productCode },
                { take: 1 }
              )
              const inventoryData = {
                sku: productCode,
                available_stock: Number(card.availableStock ?? 0),
                physical_stock: Number(card.physicalStock ?? 0),
                reserved_stock: Number(card.reservedStock ?? 0),
                blocked_stock: Number(card.blockedStock ?? 0),
                warehouse_code: warehouseCode,
                last_synced_at: new Date().toISOString(),
                stock_changed: true,
                previous_available: existing[0]?.available_stock ?? 0,
              }
              if (existing[0]) {
                await dextrumService.updateDextrumInventorys(existing[0].id, inventoryData)
              } else {
                await dextrumService.createDextrumInventorys(inventoryData)
              }
            }
          }
        } catch (invErr: any) {
          console.error("[Webhook] Inventory update failed for", productCode, invErr.message)
        }
      }
    }

    // 6. Log the event
    await dextrumService.createDextrumEventLogs({
      event_id: event.eventId,
      event_type: eventType,
      event_subtype: eventSubtype || null,
      document_id: documentId || null,
      document_code: documentCode || null,
      status: orderMap ? "processed" : "unmatched",
      medusa_order_id: orderMap?.medusa_order_id || null,
      delivery_status_before: previousStatus,
      delivery_status_after: newStatus || null,
      raw_payload: event,
    })

    res.json({ ok: true, delivery_status: newStatus || "no_change" })
  } catch (error: any) {
    console.error("mySTOCK webhook error:", error)
    // Always return 200 to prevent mySTOCK from retrying
    res.json({ ok: false, error: error.message })
  }
}
