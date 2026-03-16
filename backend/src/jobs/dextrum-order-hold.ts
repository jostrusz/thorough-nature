import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../modules/dextrum"
import { MyStockApiClient } from "../modules/dextrum/api-client"

/**
 * Dextrum Order Hold Processor
 * Runs every minute — checks for orders past their hold_until time
 * and sends them to the warehouse.
 */
export default async function dextrumOrderHold(container: MedusaContainer) {
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any
  const orderModuleService = container.resolve(Modules.ORDER) as any
  const query = container.resolve("query") as any

  try {
    // 1. Get config
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config?.enabled || !config.api_url) return

    // 2. Find orders in WAITING status past their hold time
    const allWaiting = await dextrumService.listDextrumOrderMaps(
      { delivery_status: "WAITING" },
      { take: 50 }
    )

    const now = new Date()
    const readyToSend = allWaiting.filter((o: any) => {
      if (!o.hold_until) return true
      return new Date(o.hold_until) <= now
    })

    if (readyToSend.length === 0) return

    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

    for (const orderMap of readyToSend) {
      try {
        // 3. RE-FETCH fresh order data from Medusa (CRITICAL — catches modifications)
        const { data: [order] } = await query.graph({
          entity: "order",
          fields: [
            "id", "display_id", "email", "currency_code", "total",
            "metadata", "items.*", "items.variant.*", "items.variant.product.*",
            "shipping_address.*", "shipping_methods.*",
            "payment_collections.*", "payment_collections.payments.*",
          ],
          filters: { id: orderMap.medusa_order_id },
        })

        if (!order) {
          console.error(`[Dextrum Hold] Order ${orderMap.medusa_order_id} not found`)
          continue
        }

        // 4. Check payment
        const pc = (order as any).payment_collections?.[0]
        const isPaid = pc?.status === "captured" || pc?.status === "completed"
        const isCOD = (order as any).metadata?.payment_method === "cod"

        if (!isPaid && !isCOD) {
          // Not paid yet — increment retry
          const retries = (orderMap.retry_count || 0) + 1
          if (retries > config.retry_max_attempts) {
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              delivery_status: "FAILED",
              delivery_status_updated_at: now.toISOString(),
              last_error: "Payment timeout — order not paid within time limit",
              retry_count: retries,
            })
            const meta = (order as any).metadata || {}
            await orderModuleService.updateOrders(orderMap.medusa_order_id, {
              metadata: { ...meta, dextrum_status: "FAILED", dextrum_error: "Payment timeout" },
            })
          } else {
            const nextRetry = new Date(now.getTime() + config.retry_interval_minutes * 60 * 1000)
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              hold_until: nextRetry.toISOString(),
              retry_count: retries,
              last_error: `Waiting for payment (retry ${retries}/${config.retry_max_attempts})`,
            })
          }
          continue
        }

        // 5. Build payload from FRESH data
        const addr = (order as any).shipping_address || {}
        const countryCode = addr.country_code?.toUpperCase() || "CZ"
        const prefixMap: Record<string, string> = {
          NL: "NL", BE: "BE", DE: "DE", AT: "AT", LU: "LU",
          PL: "PL", CZ: "CZ", SK: "SK", SE: "SE", HU: "HU",
        }
        const orderCode = orderMap.mystock_order_code || `${prefixMap[countryCode] || countryCode}-${(order as any).display_id}`

        const rawItems = (order as any).items || []
        console.log(`[Dextrum Hold] Order ${orderCode} items count: ${(order as any).items?.length ?? 'undefined'}, keys: ${Object.keys(order as any).join(', ')}`)
        const orderItems = rawItems.map((item: any) => ({
          productCode: item.variant?.sku || "UNKNOWN",
          quantity: item.quantity || 1,
          unitPrice: Number(item.unit_price) || 0,
          productName: item.variant?.product?.title || item.title || "",
        }))

        // 5b. Safety: do not send empty orders — retry later
        if (orderItems.length === 0) {
          console.warn(`[Dextrum Hold] Order ${orderCode} has no items (raw items: ${rawItems.length}), retrying later`)
          const retries = (orderMap.retry_count || 0) + 1
          if (retries > (config.retry_max_attempts || 10)) {
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              delivery_status: "FAILED",
              delivery_status_updated_at: now.toISOString(),
              last_error: "Order has no items after max retries",
              retry_count: retries,
            })
          } else {
            await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
              hold_until: new Date(now.getTime() + 2 * 60 * 1000).toISOString(),
              retry_count: retries,
              last_error: `Order has no items (retry ${retries})`,
            })
          }
          continue
        }

        // 6. Safety: skip if already sent (e.g., by manual send route)
        if (orderMap.mystock_order_id) {
          console.log(`[Dextrum Hold] Order ${orderCode} already sent (${orderMap.mystock_order_id}), skipping`)
          continue
        }

        // 7. Send to mySTOCK
        const orderMeta = (order as any).metadata || {}
        const deliveryFee = Number(orderMeta.shipping_fee) || 0
        const isPickup = orderMeta.shipping_method === "zasilkovna_pickup"

        // Build note with Zásilkovna pickup point info
        let orderNote = ""
        if (isPickup && orderMeta.packeta_point_id) {
          orderNote = `Zásilkovna pickup: ${orderMeta.packeta_point_name || ""} (ID: ${orderMeta.packeta_point_id})`
        }

        // Resolve delivery method: pickup vs standard
        const deliveryMethodId = isPickup
          ? (config.default_pickup_delivery_method_id || config.default_delivery_method_id || "")
          : (config.default_delivery_method_id || "")

        // Resolve payment method: COD vs paid
        const paymentMethodId = isCOD
          ? (config.default_payment_method_cod || "")
          : (config.default_payment_method_paid || "")

        const wmsResult = await client.createOrder({
          orderCode,
          operatingUnitId: config.default_warehouse_code || "",
          partnerId: config.partner_id || "",
          orderItems,
          deliveryAddress: {
            name: [addr.first_name, addr.last_name].filter(Boolean).join(" "),
            street: [addr.address_1, addr.address_2].filter(Boolean).join(", "),
            city: addr.city || "",
            zip: addr.postal_code || "",
            countryCode,
            phone: addr.phone || "",
            email: (order as any).email || "",
          },
          deliveryMethodId: deliveryMethodId || undefined,
          paymentMethodId: paymentMethodId || undefined,
          cashAmount: isCOD ? (Number((order as any).total) || 0) + (Number(orderMeta.cod_fee) || 0) + deliveryFee : undefined,
          note: orderNote || undefined,
        })

        // 7. Update dextrum_order_map
        const sentAt = new Date().toISOString()
        await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
          mystock_order_id: wmsResult.id,
          delivery_status: "IMPORTED",
          delivery_status_updated_at: sentAt,
          sent_to_wms_at: sentAt,
          last_error: null,
          retry_count: 0,
        })

        // 8. Update order metadata
        const meta = (order as any).metadata || {}
        await orderModuleService.updateOrders(orderMap.medusa_order_id, {
          metadata: {
            ...meta,
            dextrum_status: "IMPORTED",
            dextrum_order_code: orderCode,
            dextrum_mystock_id: wmsResult.id,
            dextrum_sent_at: sentAt,
          },
        })

        console.log(`[Dextrum Hold] Order ${orderCode} sent to WMS → ${wmsResult.id}`)
      } catch (err: any) {
        console.error(`[Dextrum Hold] Failed to send ${orderMap.mystock_order_code}:`, err.message)
        await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
          retry_count: (orderMap.retry_count || 0) + 1,
          last_error: err.message,
          hold_until: new Date(now.getTime() + (config.retry_interval_minutes || 5) * 60 * 1000).toISOString(),
        })
      }
    }
  } catch (error: any) {
    console.error("[Dextrum Hold] Job failed:", error.message)
  }
}

export const config = {
  name: "dextrum-order-hold",
  schedule: "* * * * *",
}
