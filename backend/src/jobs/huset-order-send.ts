// @ts-nocheck
/**
 * Huset Order Send Processor
 * Runs every minute — picks huset_order_map rows in WAITING status past their
 * hold_until time, verifies payment, and sends them to the Huset WMS
 * (3PLhuset Landvetter) via SOAP UpdateOutgoingDeliveryOrder.
 *
 * Mirror of dextrum-order-hold.ts for the slipp-taket (NO) project.
 */
import { MedusaContainer } from "@medusajs/framework/types"
import { Pool } from "pg"
import { HUSET_MODULE } from "../modules/huset"
import { getHusetConfig } from "../modules/huset/config"
import { sendOrderToHuset } from "../modules/huset/send-order"

export default async function husetOrderSend(container: MedusaContainer) {
  const config = getHusetConfig()
  if (!config.enabled) return

  const husetService = container.resolve(HUSET_MODULE) as any
  const query = container.resolve("query") as any

  try {
    // 1. Find orders in WAITING status past their hold time (oldest-due first)
    const allWaiting = await husetService.listHusetOrderMaps(
      { delivery_status: "WAITING" },
      { take: 50, order: { hold_until: "ASC" } }
    )

    const now = new Date()
    const readyToSend = allWaiting.filter((o: any) => {
      if (!o.hold_until) return true
      return new Date(o.hold_until) <= now
    })
    if (readyToSend.length === 0) return

    if (!config.hashKey) {
      console.error("[Huset Send] HUSET_HASHKEY missing — cannot send orders")
      return
    }

    for (const orderMap of readyToSend) {
      try {
        // 2. RE-FETCH fresh order data (catches cancellations/modifications)
        const { data: [order] } = await query.graph({
          entity: "order",
          fields: [
            "id", "display_id", "email", "currency_code", "total", "sales_channel_id",
            "metadata", "items.*", "items.variant.*", "items.variant.product.*",
            "shipping_address.*", "billing_address.*", "shipping_methods.*",
            "payment_collections.*", "payment_collections.payments.*",
          ],
          filters: { id: orderMap.medusa_order_id },
        })

        if (!order) {
          await husetService.updateHusetOrderMaps({ id: orderMap.id,
            delivery_status: "FAILED",
            delivery_status_updated_at: now.toISOString(),
            last_error: "Medusa order not found (deleted?)",
          })
          console.error(`[Huset Send] Order ${orderMap.medusa_order_id} not found — marked FAILED`)
          continue
        }

        // 3. Payment gate — ALL payment collections (first may be canceled after upsell)
        const paidStatuses = ["captured", "completed", "authorized"]
        const isPaid = ((order as any).payment_collections || []).some(
          (pc: any) => paidStatuses.includes(pc.status)
        )
        const isCOD = (order as any).metadata?.payment_method === "cod"

        if (!isPaid && !isCOD) {
          const retries = (orderMap.retry_count || 0) + 1
          if (retries > config.retryMaxAttempts) {
            await husetService.updateHusetOrderMaps({ id: orderMap.id,
              delivery_status: "FAILED",
              delivery_status_updated_at: now.toISOString(),
              last_error: "Payment timeout — order not paid within time limit",
              retry_count: retries,
            })
            const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
            try {
              await p.query(
                `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify({ huset_status: "FAILED", dextrum_status: "FAILED", huset_error: "Payment timeout" }), orderMap.medusa_order_id]
              )
            } finally {
              await p.end().catch(() => {})
            }
          } else {
            const nextRetry = new Date(now.getTime() + config.retryIntervalMinutes * 60 * 1000)
            await husetService.updateHusetOrderMaps({ id: orderMap.id,
              hold_until: nextRetry.toISOString(),
              retry_count: retries,
              last_error: `Waiting for payment (retry ${retries}/${config.retryMaxAttempts})`,
            })
          }
          continue
        }

        // 4. Safety: skip if already sent (e.g. by manual admin send)
        if (orderMap.outgoing_delivery_order_id) {
          console.log(`[Huset Send] Order ${orderMap.order_ref} already sent (${orderMap.outgoing_delivery_order_id}), marking IMPORTED`)
          await husetService.updateHusetOrderMaps({ id: orderMap.id,
            delivery_status: "IMPORTED",
            delivery_status_updated_at: now.toISOString(),
          })
          continue
        }

        // 5. Send via shared logic (builds items, address, SOAP call, metadata)
        await sendOrderToHuset({ order, orderMap, husetService, config })
      } catch (err: any) {
        console.error(`[Huset Send] Failed to send ${orderMap.order_ref}:`, err.message)
        await husetService.updateHusetOrderMaps({ id: orderMap.id,
          retry_count: (orderMap.retry_count || 0) + 1,
          last_error: err.message,
          hold_until: new Date(now.getTime() + config.retryIntervalMinutes * 60 * 1000).toISOString(),
        })
      }
    }
  } catch (error: any) {
    console.error("[Huset Send] Job failed:", error.message)
  }
}

export const config = {
  name: "huset-order-send",
  schedule: "* * * * *",
}
