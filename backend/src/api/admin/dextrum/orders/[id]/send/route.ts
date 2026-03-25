import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { DEXTRUM_MODULE } from "../../../../../../modules/dextrum"
import { MyStockApiClient } from "../../../../../../modules/dextrum/api-client"
import { normalizePhone } from "../../../../../../utils/normalize-phone"
import { normalizePostalCode } from "../../../../../../utils/normalize-postal-code"

// POST /admin/dextrum/orders/:id/send — Manually send order to WMS
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { id: medusaOrderId } = req.params
    const dextrumService = req.scope.resolve(DEXTRUM_MODULE) as any
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // 1. Get Dextrum config
    const configs = await dextrumService.listDextrumConfigs({}, { take: 1 })
    const config = configs[0]
    if (!config) {
      res.status(400).json({ error: "Dextrum not configured" })
      return
    }

    // 2. Fetch fresh order data from Medusa
    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "email", "currency_code", "total", "sales_channel_id",
        "metadata", "items.*", "items.variant.*", "items.variant.product.*",
        "shipping_address.*", "shipping_methods.*",
        "payment_collections.*", "payment_collections.payments.*",
      ],
      filters: { id: medusaOrderId },
    })

    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // 3. Check if order map already exists (resend support)
    const existing = await dextrumService.listDextrumOrderMaps(
      { medusa_order_id: medusaOrderId },
      { take: 1 }
    )
    const isResend = !!existing[0]?.mystock_order_id
    const resendCount = isResend ? (existing[0].resend_count || 0) + 1 : 0

    if (isResend) {
      console.log(`[Dextrum] Resending order ${medusaOrderId} (attempt #${resendCount})`)
    }

    // 4. Build order code — use existing map's base code, add -R suffix for resends
    const countryCode = (order as any).shipping_address?.country_code?.toUpperCase() || "CZ"
    let baseOrderCode: string
    if (existing[0]?.mystock_order_code) {
      // Strip any existing -R suffix to get the base code
      baseOrderCode = existing[0].mystock_order_code.replace(/-R\d+$/, "")
    } else {
      const prefixMap: Record<string, string> = {
        NL: "NL", BE: "BE", DE: "DE", AT: "AT", LU: "LU",
        PL: "PL", CZ: "CZ", SK: "SK", SE: "SE", HU: "HU",
      }
      const prefix = prefixMap[countryCode] || countryCode
      const year = new Date().getFullYear()
      baseOrderCode = `${prefix}${year}-${(order as any).display_id}`
    }
    const orderCode = isResend ? `${baseOrderCode}-R${resendCount}` : baseOrderCode

    const projectCode = (order as any).metadata?.project_code || "DEFAULT"

    // 5. Check if this exact order code was already sent (prevents duplicates)
    if (!isResend) {
      const existingByCode = await dextrumService.listDextrumOrderMaps(
        { mystock_order_code: orderCode },
        { take: 1 }
      )
      if (existingByCode[0]?.mystock_order_id) {
        res.status(400).json({
          error: `Order code ${orderCode} was already sent to WMS`,
          dextrum_order: existingByCode[0],
        })
        return
      }
    }

    // 6. Check payment status
    const paymentStatus = getPaymentStatus(order as any)
    const isCOD = (order as any).metadata?.payment_method === "cod" ||
                  (order as any).shipping_methods?.[0]?.data?.is_cod === true
    if (!isCOD && paymentStatus !== "paid" && paymentStatus !== "captured" && paymentStatus !== "authorized") {
      res.status(400).json({ error: "Order not paid. Only paid orders or COD can be sent to WMS." })
      return
    }

    // 7. Build items
    console.log(`[Dextrum Send] Order ${medusaOrderId} items count: ${(order as any).items?.length ?? 'undefined'}, keys: ${Object.keys(order as any).join(', ')}`)
    const orderItems = ((order as any).items || []).map((item: any) => ({
      productCode: item.variant?.sku || item.variant?.product?.handle || "UNKNOWN",
      quantity: item.quantity || 1,
      unitPrice: Number(item.unit_price) || 0,
      productName: item.variant?.product?.title || item.title || "",
    }))

    if (orderItems.length === 0) {
      res.status(400).json({ error: "Order has no items. Cannot send to WMS." })
      return
    }

    // 8. Build address (mySTOCK partyIdentification format)
    const addr = (order as any).shipping_address || {}
    const addrCountry = addr.country_code?.toUpperCase() || "NL"
    const phoneResult = normalizePhone(addr.phone, addrCountry)
    if (phoneResult.warning) {
      console.log(`[Dextrum Send] ${medusaOrderId}: ${phoneResult.warning}`)
    }
    const postalResult = normalizePostalCode(addr.postal_code, addrCountry)
    if (postalResult.warning) {
      console.log(`[Dextrum Send] ${medusaOrderId}: ${postalResult.warning}`)
    }
    const deliveryAddress: any = {
      firstName: addr.first_name || "",
      lastName: addr.last_name || "",
      company: addr.company || undefined,
      street: [addr.address_1, addr.address_2].filter(Boolean).join(", "),
      city: addr.city || "",
      zip: postalResult.normalized,
      country: addrCountry,
      phone: phoneResult.normalized,
      email: (order as any).email || "",
    }
    // Log phone normalization in order timeline
    if (phoneResult.changed || phoneResult.warning) {
      try {
        const orderService = req.scope.resolve(Modules.ORDER) as any
        const existingMeta = (order as any).metadata || {}
        const dextrumTimeline = Array.isArray(existingMeta.dextrum_timeline) ? [...existingMeta.dextrum_timeline] : []
        dextrumTimeline.push({
          status: phoneResult.changed ? "PHONE_NORMALIZED" : "PHONE_MISSING",
          date: new Date().toISOString(),
          detail: phoneResult.warning || `Phone: ${phoneResult.normalized}`,
        })
        await orderService.updateOrders([{
          id: medusaOrderId,
          metadata: {
            ...existingMeta,
            phone_normalization: {
              original: phoneResult.original,
              normalized: phoneResult.normalized,
              changed: phoneResult.changed,
              warning: phoneResult.warning || null,
              timestamp: new Date().toISOString(),
            },
            dextrum_timeline: dextrumTimeline,
          },
        }])
      } catch { /* non-critical */ }
    }

    // 9. Send to mySTOCK
    const client = new MyStockApiClient({
      apiUrl: config.api_url,
      username: config.api_username,
      password: config.api_password,
    })

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
      deliveryMethodId = (mapping.delivery_method_id || "").trim()
      paymentMethodId = (mapping.payment_method_id || "").trim()
      externalCarrierCode = (mapping.external_carrier_code || "").trim()
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
    }

    // Add pickup place code for Zásilkovna
    if (isPickup && orderMeta.packeta_point_id) {
      deliveryAddress.pickupPlaceCode = orderMeta.packeta_point_id
    }
    if (externalCarrierCode) {
      deliveryAddress.externalCarrierCode = externalCarrierCode
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

    // 10. Create or update dextrum_order_map
    const now = new Date().toISOString()
    if (existing[0]) {
      await dextrumService.updateDextrumOrderMaps({ id: existing[0].id,
        mystock_order_id: wmsResult.id,
        mystock_order_code: orderCode,
        delivery_status: "IMPORTED",
        delivery_status_updated_at: now,
        sent_to_wms_at: now,
        last_error: null,
        resend_count: resendCount,
      })
    } else {
      await dextrumService.createDextrumOrderMaps({
        medusa_order_id: medusaOrderId,
        display_id: String((order as any).display_id),
        project_code: projectCode,
        mystock_order_code: orderCode,
        mystock_order_id: wmsResult.id,
        delivery_status: "IMPORTED",
        delivery_status_updated_at: now,
        sent_to_wms_at: now,
        resend_count: 0,
      })
    }

    // 11. Update order metadata with dextrum status
    const existingMeta = (order as any).metadata || {}

    // Add RESENT timeline entry if this is a resend
    const dextrumTimeline = existingMeta.dextrum_timeline || []
    if (isResend) {
      dextrumTimeline.push({
        type: "dextrum",
        status: "RESENT",
        date: now,
        detail: `Order resent to warehouse (attempt #${resendCount})`,
      })
    }
    // Add IMPORTED timeline entry
    dextrumTimeline.push({
      type: "dextrum",
      status: "IMPORTED",
      date: now,
      detail: `WMS Order: ${orderCode}`,
    })

    const updatedMeta = {
      ...existingMeta,
      dextrum_status: "IMPORTED",
      dextrum_order_code: orderCode,
      dextrum_mystock_id: wmsResult.id,
      dextrum_sent_at: now,
      dextrum_timeline: dextrumTimeline,
        // Clear old tracking on resend so new tracking comes through
        ...(isResend ? {
          dextrum_tracking_number: null,
          dextrum_tracking_url: null,
          dextrum_carrier: null,
        } : {}),
      }
    const { Pool } = require("pg")
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    await pool.query(
      `UPDATE "order" SET metadata = $1::jsonb, updated_at = NOW() WHERE id = $2`,
      [JSON.stringify(updatedMeta), medusaOrderId]
    )
    await pool.end()

    res.json({
      success: true,
      order_code: orderCode,
      mystock_id: wmsResult.id,
      delivery_status: "IMPORTED",
    })
  } catch (error: any) {
    console.error("Dextrum send order error:", error)
    res.status(500).json({ error: error.message })
  }
}

function getPaymentStatus(order: any): string {
  if (order.payment_collections?.length) {
    // Check ALL payment collections — find any that is paid
    const paidStatuses = ["captured", "completed", "authorized"]
    for (const pc of order.payment_collections) {
      if (paidStatuses.includes(pc.status)) return "paid"
    }
    // If none is paid, return the first non-canceled status
    for (const pc of order.payment_collections) {
      if (pc.status !== "canceled") return pc.status || "pending"
    }
    return order.payment_collections[0].status || "pending"
  }
  return "pending"
}
