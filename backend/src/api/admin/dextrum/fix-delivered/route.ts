import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../../../../modules/dextrum"

/**
 * POST /admin/dextrum/fix-delivered
 * One-time fix: find orders where Event 29 had delivery note ("Doručeno", "Zásilka je u vás")
 * but status was set to DISPATCHED instead of DELIVERED. Fix them.
 *
 * Query params:
 *   ?dry_run=true  — only show what would be fixed, don't actually update (default)
 *   ?dry_run=false — actually fix the orders
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const dryRun = req.query.dry_run !== "false"
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderService = req.scope.resolve(Modules.ORDER) as any

    // 1. Find all Event 29 logs with delivery notes
    const allEvents = await dextrumService.listDextrumEventLogs(
      { event_type: "29" },
      { take: 5000, order: { created_at: "DESC" } }
    )

    console.log(`[Fix Delivered] Found ${allEvents.length} Event 29 entries total`)

    // 2. Filter events with delivery notes
    const deliveryPhrases = ["doručen", "zásilka je u vás", "delivered", "převzat", "vyzvednut", "dodán"]
    const deliveryEvents = allEvents.filter((evt: any) => {
      const payload = typeof evt.raw_payload === "string" ? evt.raw_payload : JSON.stringify(evt.raw_payload || "")
      const noteLower = payload.toLowerCase()
      return deliveryPhrases.some((phrase) => noteLower.includes(phrase))
    })

    console.log(`[Fix Delivered] Found ${deliveryEvents.length} events with delivery notes`)

    // 3. Get unique document codes from delivery events
    const docCodes = new Set<string>()
    for (const evt of deliveryEvents) {
      if (evt.document_code) docCodes.add(evt.document_code)
    }

    console.log(`[Fix Delivered] Unique order codes to check: ${docCodes.size}`)

    // 4. Find order maps that are still DISPATCHED (should be DELIVERED)
    const toFix: any[] = []
    const alreadyFixed: any[] = []
    const notFound: string[] = []

    for (const code of docCodes) {
      const maps = await dextrumService.listDextrumOrderMaps(
        { mystock_order_code: code },
        { take: 1 }
      )
      const map = maps[0]
      if (!map) {
        notFound.push(code)
        continue
      }

      if (map.delivery_status === "DELIVERED") {
        alreadyFixed.push({ code, medusaOrderId: map.medusa_order_id })
        continue
      }

      // This order should be DELIVERED but isn't
      toFix.push({
        code,
        medusaOrderId: map.medusa_order_id,
        currentStatus: map.delivery_status,
        mapId: map.id,
      })
    }

    console.log(`[Fix Delivered] To fix: ${toFix.length}, Already DELIVERED: ${alreadyFixed.length}, Not found: ${notFound.length}`)

    if (dryRun) {
      res.json({
        dry_run: true,
        message: "Add ?dry_run=false to actually fix these orders",
        to_fix: toFix.length,
        already_delivered: alreadyFixed.length,
        not_found: notFound.length,
        orders_to_fix: toFix,
        not_found_codes: notFound,
      })
      return
    }

    // 5. Actually fix the orders
    const now = new Date().toISOString()
    const fixed: any[] = []
    const errors: any[] = []

    for (const order of toFix) {
      try {
        // Update dextrum_order_map
        await dextrumService.updateDextrumOrderMaps({
          id: order.mapId,
          delivery_status: "DELIVERED",
          delivery_status_updated_at: now,
          delivered_at: now,
        })

        // Update Medusa order metadata
        const { data: [medusaOrder] } = await query.graph({
          entity: "order",
          fields: ["id", "metadata"],
          filters: { id: order.medusaOrderId },
        })

        if (medusaOrder) {
          const existingMeta = medusaOrder.metadata || {}
          const timeline = Array.isArray(existingMeta.dextrum_timeline)
            ? [...existingMeta.dextrum_timeline]
            : []

          timeline.push({
            type: "dextrum",
            status: "DELIVERED",
            date: now,
            detail: `Status corrected from ${order.currentStatus} to DELIVERED (bulk fix)`,
          })

          await orderService.updateOrders([{
            id: order.medusaOrderId,
            metadata: {
              ...existingMeta,
              dextrum_status: "DELIVERED",
              dextrum_status_updated_at: now,
              dextrum_timeline: timeline,
            },
          }])
        }

        fixed.push({ code: order.code, from: order.currentStatus, to: "DELIVERED" })
        console.log(`[Fix Delivered] ✅ Fixed ${order.code}: ${order.currentStatus} → DELIVERED`)
      } catch (err: any) {
        errors.push({ code: order.code, error: err.message })
        console.error(`[Fix Delivered] ❌ Failed ${order.code}:`, err.message)
      }
    }

    res.json({
      dry_run: false,
      fixed: fixed.length,
      errors: errors.length,
      already_delivered: alreadyFixed.length,
      not_found: notFound.length,
      fixed_orders: fixed,
      error_details: errors,
      not_found_codes: notFound,
    })
  } catch (error: any) {
    console.error("[Fix Delivered] Error:", error)
    res.status(500).json({ error: error.message })
  }
}
