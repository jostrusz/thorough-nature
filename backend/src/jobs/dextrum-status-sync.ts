import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"
import { MyStockApiClient } from "../modules/dextrum/api-client"

/**
 * Dextrum Status Sync Job
 * Runs every 5 minutes — polls mySTOCK for order status updates
 * and syncs delivery_status to both dextrum_order_map and order metadata.
 */
export default async function dextrumStatusSync(container: MedusaContainer) {
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any
  const orderModuleService = container.resolve(Modules.ORDER) as any
  const query = container.resolve("query") as any

  try {
    // 1. Get config
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config?.enabled || !config.api_url) {
      return
    }

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    // 2. Get all active orders (not DELIVERED, not CANCELLED, not FAILED)
    const activeOrders = await dextrumService.listDextrumOrderMaps(
      {},
      { take: 200, order: { created_at: "DESC" } }
    )

    const ordersToSync = activeOrders.filter((o: any) =>
      o.mystock_order_id &&
      !["DELIVERED", "CANCELLED", "FAILED"].includes(o.delivery_status)
    )

    if (ordersToSync.length === 0) return

    let updated = 0

    // 3. Poll each active order
    for (const orderMap of ordersToSync) {
      try {
        const wmsOrder = await client.getOrder(orderMap.mystock_order_id)
        if (!wmsOrder) continue

        const newStatus = mapWmsStatus(wmsOrder)
        if (!newStatus || newStatus === orderMap.delivery_status) continue

        const now = new Date().toISOString()
        const updateData: any = {
          delivery_status: newStatus,
          delivery_status_updated_at: now,
        }

        if (wmsOrder.trackingNumber) updateData.tracking_number = wmsOrder.trackingNumber
        if (wmsOrder.trackingUrl) updateData.tracking_url = wmsOrder.trackingUrl
        if (wmsOrder.carrierName) updateData.carrier_name = wmsOrder.carrierName
        if (wmsOrder.packageCount) updateData.package_count = wmsOrder.packageCount
        if (wmsOrder.totalWeight) updateData.total_weight_kg = String(wmsOrder.totalWeight)
        if (newStatus === "DISPATCHED") updateData.dispatched_at = now
        if (newStatus === "DELIVERED") updateData.delivered_at = now

        await dextrumService.updateDextrumOrderMaps(orderMap.id, updateData)

        // Update Medusa order metadata
        try {
          const { data: [order] } = await query.graph({
            entity: "order",
            fields: ["id", "metadata"],
            filters: { id: orderMap.medusa_order_id },
          })
          if (order) {
            const meta = (order as any).metadata || {}
            await orderModuleService.updateOrders(orderMap.medusa_order_id, {
              metadata: {
                ...meta,
                dextrum_status: newStatus,
                dextrum_status_updated_at: now,
                dextrum_tracking_number: updateData.tracking_number || meta.dextrum_tracking_number,
                dextrum_tracking_url: updateData.tracking_url || meta.dextrum_tracking_url,
                dextrum_carrier: updateData.carrier_name || meta.dextrum_carrier,
              },
            })
          }
        } catch (err: any) {
          console.error(`Failed to update metadata for order ${orderMap.medusa_order_id}:`, err.message)
        }

        updated++
      } catch (err: any) {
        console.error(`Dextrum sync error for order ${orderMap.mystock_order_code}:`, err.message)
      }
    }

    if (updated > 0) {
      console.log(`[Dextrum Sync] Updated ${updated}/${ordersToSync.length} orders`)
    }
  } catch (error: any) {
    console.error("[Dextrum Sync] Job failed:", error.message)
  }
}

function mapWmsStatus(wmsOrder: any): string | null {
  const status = (wmsOrder.status || wmsOrder.state || "").toLowerCase()
  const phase = (wmsOrder.phase || wmsOrder.processingPhase || "").toLowerCase()

  if (status === "cancelled" || status === "canceled") return "CANCELLED"
  if (status === "delivered" || phase === "delivered") return "DELIVERED"
  if (status === "dispatched" || status === "shipped" || phase === "dispatched") return "DISPATCHED"
  if (status === "packed" || phase === "packed") return "PACKED"
  if (status === "processed" || status === "picked" || phase === "picked") return "PROCESSED"
  if (status === "received" || status === "imported" || phase === "received") return "IMPORTED"
  if (status === "allocation_issue" || status === "stock_issue") return "ALLOCATION_ISSUE"

  return null
}

export const config = {
  name: "dextrum-status-sync",
  schedule: "*/5 * * * *",
}
