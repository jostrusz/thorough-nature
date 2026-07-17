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
    const isManualOrder = (order as any).metadata?.created_by === "manual_ai_order_creator"
    if (!isCOD && !isManualOrder && paymentStatus !== "paid" && paymentStatus !== "captured" && paymentStatus !== "authorized") {
      res.status(400).json({ error: "Order not paid. Only paid orders or COD can be sent to WMS." })
      return
    }

    // 7. Build items
    /**
     * SKU mapping for bundle variants → physical warehouse SKU.
     * Kept in sync with jobs/dextrum-order-hold.ts — any new bundle
     * or upsell variant must be added in BOTH places.
     */
    const BUNDLE_SKU_MAP: Record<string, { physicalSku: string; quantity: number }> = {
      "LLWJK-1": { physicalSku: "LLWJK7824627392", quantity: 1 },
      "LLWJK-2": { physicalSku: "LLWJK7824627392", quantity: 2 },
      "LLWJK-3": { physicalSku: "LLWJK7824627392", quantity: 3 },
      "LLWJK-4": { physicalSku: "LLWJK7824627392", quantity: 4 },
      "HLDV-1": { physicalSku: "HLDV62786284629", quantity: 1 },
      "HLDV-2": { physicalSku: "HLDV62786284629", quantity: 2 },
      "HLDV-3": { physicalSku: "HLDV62786284629", quantity: 3 },
      "HLDV-4": { physicalSku: "HLDV62786284629", quantity: 4 },
      "HLDV62786284629-2": { physicalSku: "HLDV62786284629", quantity: 1 },
      "LLWJK7824627392-2": { physicalSku: "LLWJK7824627392", quantity: 1 },
      // ─── Polish: Życie, jakiego nigdy sobie nie pozwoliłaś (zycie-zaslugy) ───
      // Per-bundle variants ZJN-{N} → physical book SKU ZJNS827837491 ×N.
      "ZJN-1": { physicalSku: "ZJNS827837491", quantity: 1 },
      "ZJN-2": { physicalSku: "ZJNS827837491", quantity: 2 },
      "ZJN-3": { physicalSku: "ZJNS827837491", quantity: 3 },
      "ZJN-4": { physicalSku: "ZJNS827837491", quantity: 4 },
      // Order-bump upsell variant (ZJN-1-1) → same physical book barcode.
      "ZJN-1-1": { physicalSku: "ZJNS827837491", quantity: 1 },
      // Order-bump upsell (Życie → Odpuść cross-sell). Admin SKU has -2 suffix;
      // Dextrum holds only the parent barcode OTCCN64787237.
      "OTCCN64787237-2": { physicalSku: "OTCCN64787237", quantity: 1 },
      // Order-bump upsell (Život → Pusť to cross-sell). Admin SKU has -3 suffix;
      // Dextrum holds only the parent barcode OTCCN64787237.
      "OTCCN64787237-3": { physicalSku: "OTCCN64787237", quantity: 1 },
      // ─── Czech: Život, jaký si zasloužíš (zivot-zaslugy) ───
      // Dextrum zná jediný fyzický kód knihy: ZJSZ9827982789.
      // Varianta "1 kniha" nese rovnou fyzické SKU, bundly 2–4 mají ZKZ-{N}.
      // Bez tohoto mapování by se do WMS poslal neexistující kód "ZKZ-2" v počtu 1 ks.
      "ZJSZ9827982789": { physicalSku: "ZJSZ9827982789", quantity: 1 },
      "ZKZ-1": { physicalSku: "ZJSZ9827982789", quantity: 1 },
      "ZKZ-2": { physicalSku: "ZJSZ9827982789", quantity: 2 },
      "ZKZ-3": { physicalSku: "ZJSZ9827982789", quantity: 3 },
      "ZKZ-4": { physicalSku: "ZJSZ9827982789", quantity: 4 },
      // ─── Hungarian: Engedd el, ami tönkretesz (engedd-el) ───
      // Jediná varianta "Puhakötés" (ENGEDD-EL-PB), bundle 1–4 jede přes množství
      // na řádku — proto quantity: 1, route ho násobí line quantity.
      // Dextrum zná knihu pod kódem EEAT89789272462 (sortiment 00512375), ne pod
      // medusím SKU "ENGEDD-EL-PB".
      "ENGEDD-EL-PB": { physicalSku: "EEAT89789272462", quantity: 1 },
      // Kočičí bible — samostatný funnel (kocicibible.cz). Single-variant bundle
      // (quantity=N na variantě); Dextrum zná fyzický kód 363682 (stejná kniha
      // jako psi-superzivot upsell variant 363682).
      "KOCICI-BIBLE-OFICIAL-PB": { physicalSku: "363682", quantity: 1 },
      // Kočičí bible order bumpy — admin SKU má suffix -2, Dextrum drží rodičovský kód.
      "PTCTN2876287672-2": { physicalSku: "PTCTN2876287672", quantity: 1 },
      "ZJSZ9827982789-2": { physicalSku: "ZJSZ9827982789", quantity: 1 },
      "PZ7874294876-2": { physicalSku: "PZ7874294876", quantity: 1 },
    }

    // Filter out non-physical items (e.g. COD fee) that don't exist in the warehouse
    const SKIP_SKUS = new Set(["FEE-COD"])

    console.log(`[Dextrum Send] Order ${medusaOrderId} items count: ${(order as any).items?.length ?? 'undefined'}, keys: ${Object.keys(order as any).join(', ')}`)
    const orderItems = ((order as any).items || []).filter((item: any) => {
      const sku = item.variant?.sku || item.variant?.product?.handle || "UNKNOWN"
      if (SKIP_SKUS.has(sku)) {
        console.log(`[Dextrum Send] Skipping non-physical item: ${sku} (${item.title || item.variant?.product?.title})`)
        return false
      }
      return true
    }).map((item: any) => {
      const sku = item.variant?.sku || item.variant?.product?.handle || "UNKNOWN"
      const bundleMapping = BUNDLE_SKU_MAP[sku]

      if (bundleMapping) {
        // Bundle/upsell variant → physical SKU. Multiply per-unit bundle count by
        // the line quantity so order-bump pickers (qty>1) ship the right amount.
        console.log(`[Dextrum Send] SKU mapping: ${sku} → ${bundleMapping.quantity * (item.quantity || 1)}× ${bundleMapping.physicalSku}`)
        return {
          productCode: bundleMapping.physicalSku,
          quantity: bundleMapping.quantity * (item.quantity || 1),
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

    // Kód cizího dopravce patří ke KONKRÉTNÍMU vybranému bodu, ne k trhu.
    // Packeta (dokumentace „Carrier Pick-up point"): u vlastního výdejního místa jde
    // kód bodu do addressId; u bodu cizího dopravce jde do addressId ID DOPRAVCE
    // a kód bodu do carrierPickupPoint. V mySTOCKu tomu odpovídá dvojice
    // externalCarrierCode + pickupPlaceCode.
    //
    // Statická hodnota z mapování stačí jen tam, kde má trh jediného dopravce
    // (PL = InPost 3060). Maďarsko má v jedné síti vlastní body Packety (1270)
    // i cizí boxy (FoxPost 32970, Magyar Posta 29760), takže se musí brát
    // z objednávky — checkout ho ukládá do packeta_carrier_id (prázdný = vlastní bod).
    // Bez toho mySTOCK hledá kód cizího boxu mezi body Packety, nenajde ho a vrátí
    // "Invalid entry / partyIdentification.pickupPlaceCode" (viz HU2026-27410, -27559).
    const orderCarrierId = String(orderMeta.packeta_carrier_id || "").trim()
    if (orderCarrierId) {
      externalCarrierCode = orderCarrierId
    }

    // Set pickupPlaceCode from any available metadata source
    const pickupCode = orderMeta.packeta_point_id || orderMeta.paczkomat_id || orderMeta.pickup_place_code || ""
    if (pickupCode) {
      deliveryAddress.pickupPlaceCode = pickupCode
    }
    if (externalCarrierCode) {
      deliveryAddress.externalCarrierCode = externalCarrierCode
      if (!pickupCode) {
        console.warn(`[Dextrum Send] ${orderCode}: Carrier ${externalCarrierCode} set but no pickupPlaceCode found in metadata`)
      }
    }
    console.log(
      `[Dextrum Send] ${orderCode}: pickupPlaceCode=${pickupCode || "—"} ` +
      `externalCarrierCode=${externalCarrierCode || "—"} ` +
      `(z objednávky=${orderCarrierId || "—"}, z mapování=${(mapping?.external_carrier_code || "").trim() || "—"})`
    )

    const wmsResult = await client.createOrder({
      orderCode,
      warehouseCode: (config.default_warehouse_code || "").trim() || undefined,
      partnerId: (config.partner_id || "").trim(),
      orderItems,
      deliveryAddress,
      deliveryMethodId: (deliveryMethodId || "").trim() || undefined,
      paymentMethodId: (paymentMethodId || "").trim() || undefined,
      cashAmount: isCOD ? (Number((order as any).total) || 0) + (Number(orderMeta.cod_fee) || 0) + deliveryFee : undefined,
      cashCurrencyCode: ((order as any).currency_code || "EUR").toUpperCase(),
      note: orderNote || undefined,
    })

    // mySTOCK umí odpovědět 200 OK, a přesto objednávku nevytvořit — typicky když
    // nezná kód zboží nebo chybí metoda dopravy. Bez téhle kontroly se níž zapíše
    // IMPORTED s mystock_order_id = null: v adminu svítí „odesláno", ve skladu nic.
    // Přesně tak zmizely HU2026-27404 a HU2026-27429.
    if (!wmsResult.id) {
      throw new Error(
        `mySTOCK nevrátil ID objednávky pro ${orderCode} — objednávka NEBYLA vytvořena. ` +
        `Zkontroluj kódy zboží (${orderItems.map((i: any) => `${i.productCode}×${i.quantity}`).join(", ")}) ` +
        `a metodu dopravy (deliveryMethodId=${deliveryMethodId || "CHYBÍ"}, paymentMethodId=${paymentMethodId || "CHYBÍ"}).`
      )
    }

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
