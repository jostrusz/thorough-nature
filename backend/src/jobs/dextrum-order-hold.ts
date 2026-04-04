import { MedusaContainer } from "@medusajs/framework/types"
import { DEXTRUM_MODULE } from "../modules/dextrum"
import { MyStockApiClient } from "../modules/dextrum/api-client"
import { normalizePhone } from "../utils/normalize-phone"
import { normalizePostalCode } from "../utils/normalize-postal-code"

/**
 * Dextrum Order Hold Processor
 * Runs every minute — checks for orders past their hold_until time
 * and sends them to the warehouse.
 */
export default async function dextrumOrderHold(container: MedusaContainer) {
  const dextrumService = container.resolve(DEXTRUM_MODULE) as any
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
            "id", "display_id", "email", "currency_code", "total", "sales_channel_id",
            "metadata", "items.*", "items.variant.*", "items.variant.product.*",
            "shipping_address.*", "shipping_methods.*",
            "payment_collections.*", "payment_collections.payments.*",
          ],
          filters: { id: orderMap.medusa_order_id },
        })

        if (!order) {
          // Order was deleted — mark as FAILED to stop retrying
          await dextrumService.updateDextrumOrderMaps({ id: orderMap.id,
            delivery_status: "FAILED",
            delivery_status_updated_at: now.toISOString(),
            last_error: "Medusa order not found (deleted?)",
          })
          console.error(`[Dextrum Hold] Order ${orderMap.medusa_order_id} not found — marked FAILED`)
          continue
        }

        // 4. Check payment — check ALL payment collections (first may be canceled after upsell)
        const paidStatuses = ["captured", "completed", "authorized"]
        const isPaid = ((order as any).payment_collections || []).some(
          (pc: any) => paidStatuses.includes(pc.status)
        )
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
            const { Pool } = require("pg")
            const p = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
            await p.query(
              `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
              [JSON.stringify({ ...meta, dextrum_status: "FAILED", dextrum_error: "Payment timeout" }), orderMap.medusa_order_id]
            )
            await p.end()
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
        const countryCode = (addr.country_code || (order as any).billing_address?.country_code || "").toUpperCase()
        if (!countryCode) console.error(`[Dextrum Hold] Order ${orderMap.medusa_order_id} missing country_code!`)
        const prefixMap: Record<string, string> = {
          NL: "NL", BE: "BE", DE: "DE", AT: "AT", LU: "LU",
          PL: "PL", CZ: "CZ", SK: "SK", SE: "SE", HU: "HU",
        }
        const year = new Date().getFullYear()
        const orderCode = orderMap.mystock_order_code || `${prefixMap[countryCode] || countryCode}${year}-${(order as any).display_id}`

        const rawItems = (order as any).items || []
        console.log(`[Dextrum Hold] Order ${orderCode} items count: ${(order as any).items?.length ?? 'undefined'}, keys: ${Object.keys(order as any).join(', ')}`)

        /**
         * SKU mapping for bundle variants → physical warehouse SKU.
         * Loslatenboek uses per-bundle variants (LLWJK-1 to LLWJK-4) where the suffix
         * encodes the number of physical books. The warehouse needs the real product SKU
         * (LLWJK7824627392) with the correct quantity.
         *
         * Pattern: LLWJK-{N} → N × LLWJK7824627392
         */
        const BUNDLE_SKU_MAP: Record<string, { physicalSku: string; quantity: number }> = {
          "LLWJK-1": { physicalSku: "LLWJK7824627392", quantity: 1 },
          "LLWJK-2": { physicalSku: "LLWJK7824627392", quantity: 2 },
          "LLWJK-3": { physicalSku: "LLWJK7824627392", quantity: 3 },
          "LLWJK-4": { physicalSku: "LLWJK7824627392", quantity: 4 },
        }

        const orderItems = rawItems.map((item: any) => {
          const sku = item.variant?.sku || "UNKNOWN"
          const bundleMapping = BUNDLE_SKU_MAP[sku]

          if (bundleMapping) {
            // Bundle variant → map to physical warehouse SKU with correct quantity
            console.log(`[Dextrum Hold] SKU mapping: ${sku} → ${bundleMapping.quantity}× ${bundleMapping.physicalSku}`)
            return {
              productCode: bundleMapping.physicalSku,
              quantity: bundleMapping.quantity,
              unitPrice: Number(item.unit_price) || 0,
              productName: item.variant?.product?.title || item.title || "",
            }
          }

          return {
            productCode: sku,
            quantity: item.quantity || 1,
            unitPrice: Number(item.unit_price) || 0,
            productName: item.variant?.product?.title || item.title || "",
          }
        })

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

        // Resolve delivery & payment via delivery mappings
        const shippingOptionId = (order as any).shipping_methods?.[0]?.shipping_option_id || ""
        const salesChannelId = (order as any).sales_channel_id || orderMeta.sales_channel_id || ""

        // Look up mapping: sales_channel + shipping_option + is_cod
        let mapping: any = null
        if (salesChannelId && shippingOptionId) {
          const mappings = await dextrumService.listDextrumDeliveryMappings({
            sales_channel_id: salesChannelId,
            shipping_option_id: shippingOptionId,
            is_cod: isCOD,
          }, { take: 1 })
          mapping = mappings[0] || null
        }

        let deliveryMethodId = ""
        let paymentMethodId = ""
        let externalCarrierCode = ""

        if (mapping) {
          // Use mapping values
          deliveryMethodId = (mapping.delivery_method_id || "").trim()
          paymentMethodId = (mapping.payment_method_id || "").trim()
          externalCarrierCode = (mapping.external_carrier_code || "").trim()
          console.log(`[Dextrum Hold] Mapping found for ${orderCode}: delivery=${deliveryMethodId}, payment=${paymentMethodId}, carrier=${externalCarrierCode}`)
        } else {
          // Fallback to config defaults (shipping_option metadata not available via cross-module query)
          const soMeta: Record<string, any> = {}
          deliveryMethodId = soMeta.mystock_delivery_method_id || ""
          if (!deliveryMethodId) {
            deliveryMethodId = isPickup
              ? (config.default_pickup_delivery_method_id || config.default_delivery_method_id || "")
              : (config.default_delivery_method_id || "")
          }
          if (isCOD) {
            paymentMethodId = soMeta.mystock_payment_method_cod || config.default_payment_method_cod || ""
          } else {
            paymentMethodId = soMeta.mystock_payment_method_paid || config.default_payment_method_paid || ""
          }
          externalCarrierCode = soMeta.mystock_external_carrier_code || ""
          console.log(`[Dextrum Hold] No mapping for ${orderCode} (sc=${salesChannelId}, so=${shippingOptionId}, cod=${isCOD}), using defaults`)
        }

        // Build delivery address
        const phoneResult = normalizePhone(addr.phone, countryCode)
        if (phoneResult.warning) {
          console.log(`[Dextrum Hold] ${orderCode}: ${phoneResult.warning}`)
        }
        const postalResult = normalizePostalCode(addr.postal_code, countryCode)
        if (postalResult.warning) {
          console.log(`[Dextrum Hold] ${orderCode}: ${postalResult.warning}`)
        }
        const deliveryAddress: any = {
          firstName: addr.first_name || "",
          lastName: addr.last_name || "",
          street: [addr.address_1, addr.address_2].filter(Boolean).join(", "),
          city: addr.city || "",
          zip: postalResult.normalized,
          country: countryCode,
          phone: phoneResult.normalized,
          email: (order as any).email || "",
        }
        // Log normalizations in order timeline (ONLY ONCE — skip if already logged)
        const existingMeta = (order as any).metadata || {}
        const alreadyLoggedPhone = !!existingMeta.phone_normalization
        const alreadyLoggedPostal = !!existingMeta.postal_normalization
        const needsPhoneLog = (phoneResult.changed || phoneResult.warning) && !alreadyLoggedPhone
        const needsPostalLog = postalResult.changed && !alreadyLoggedPostal

        if (needsPhoneLog || needsPostalLog) {
          try {
            const orderService = container.resolve("order") as any
            const dextrumTimeline = Array.isArray(existingMeta.dextrum_timeline) ? [...existingMeta.dextrum_timeline] : []
            if (needsPhoneLog) {
              dextrumTimeline.push({
                status: phoneResult.changed ? "PHONE_NORMALIZED" : "PHONE_MISSING",
                date: new Date().toISOString(),
                detail: phoneResult.warning || `Phone normalized: "${phoneResult.original}" → "${phoneResult.normalized}"`,
              })
            }
            if (needsPostalLog) {
              dextrumTimeline.push({
                status: "POSTAL_NORMALIZED",
                date: new Date().toISOString(),
                detail: postalResult.warning || `Postal: ${postalResult.normalized}`,
              })
            }
            await orderService.updateOrders([{
              id: (order as any).id,
              metadata: {
                ...existingMeta,
                phone_normalization: needsPhoneLog ? {
                  original: phoneResult.original,
                  normalized: phoneResult.normalized,
                  changed: phoneResult.changed,
                  warning: phoneResult.warning || null,
                  timestamp: new Date().toISOString(),
                } : existingMeta.phone_normalization,
                postal_normalization: needsPostalLog ? {
                  original: postalResult.original,
                  normalized: postalResult.normalized,
                  changed: postalResult.changed,
                  timestamp: new Date().toISOString(),
                } : existingMeta.postal_normalization,
                dextrum_timeline: dextrumTimeline,
              },
            }])
          } catch { /* non-critical */ }
        }
        if (addr.company) deliveryAddress.company = addr.company
        // Set pickupPlaceCode from any available metadata source
        const pickupCode = orderMeta.packeta_point_id || orderMeta.paczkomat_id || orderMeta.pickup_place_code || ""
        if (pickupCode) {
          deliveryAddress.pickupPlaceCode = pickupCode
        }
        if (externalCarrierCode) {
          deliveryAddress.externalCarrierCode = externalCarrierCode
          // If carrier requires pickup place code but none available, log warning
          if (!pickupCode) {
            console.warn(`[Dextrum Hold] ${orderCode}: Carrier ${externalCarrierCode} set but no pickupPlaceCode found in metadata`)
          }
        }

        const wmsResult = await client.createOrder({
          orderCode,
          warehouseCode: (config.default_warehouse_code || "").trim() || undefined,
          partnerId: (config.partner_id || "").trim(),
          orderItems,
          deliveryAddress,
          deliveryMethodId: (deliveryMethodId || "").trim() || undefined,
          paymentMethodId: (paymentMethodId || "").trim() || undefined,
          cashAmount: isCOD ? (Number((order as any).total) || 0) + (Number(orderMeta.cod_fee) || 0) + deliveryFee : undefined,
          cashCurrencyCode: "EUR",
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

        // 8. Update order metadata via direct DB query
        const meta = (order as any).metadata || {}
        const updatedMeta = {
          ...meta,
          dextrum_status: "IMPORTED",
          dextrum_order_code: orderCode,
          dextrum_mystock_id: wmsResult.id,
          dextrum_sent_at: sentAt,
        }
        const { Pool: PgPool } = require("pg")
        const pgPool = new PgPool({ connectionString: process.env.DATABASE_URL, max: 2 })
        await pgPool.query(
          `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify(updatedMeta), orderMap.medusa_order_id]
        )
        await pgPool.end()

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
