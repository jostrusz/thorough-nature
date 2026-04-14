// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { PROFITABILITY_MODULE } from "../../../../modules/profitability"

/**
 * POST /admin/custom-orders/create
 *
 * Creates an order manually from admin-confirmed data.
 * Used by the AI Order Creator after admin reviews extracted fields.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService = req.scope.resolve(Modules.ORDER)

    const body = req.body as any
    const {
      first_name,
      last_name,
      email,
      phone,
      address_1,
      address_2,
      city,
      postal_code,
      country_code,
      project_slug,
      product_id,
      variant_id,
      product_title,
      quantity = 1,
      unit_price,
      currency_code = "eur",
      payment_id,
      payment_method,
      payment_status = "paid",
      notes,
      shipping_option_id,
      shipping_option_name,
      shipping_method_type,
      pickup_point_id,
      pickup_point_name,
    } = body

    // Validate required fields
    const missing: string[] = []
    if (!first_name) missing.push("first_name")
    if (!last_name) missing.push("last_name")
    if (!email) missing.push("email")
    if (!address_1) missing.push("address_1")
    if (!city) missing.push("city")
    if (!postal_code) missing.push("postal_code")
    if (!country_code) missing.push("country_code")
    if (!product_title && !variant_id) missing.push("product_title or variant_id")
    if (unit_price == null) missing.push("unit_price")

    if (missing.length > 0) {
      res.status(400).json({ error: `Missing required fields: ${missing.join(", ")}` })
      return
    }

    // Resolve project config for sales_channel_id and region
    let salesChannelId: string | null = null
    let regionId: string | null = null

    if (project_slug) {
      try {
        const profitService = req.scope.resolve(PROFITABILITY_MODULE) as any
        const configs = await profitService.listProjectConfigs(
          { project_slug },
          { take: 1 }
        )
        if (configs?.length > 0) {
          salesChannelId = configs[0].sales_channel_id
        }
      } catch (e) {
        console.warn("[Create Order] Could not resolve project:", (e as Error).message)
      }
    }

    // Resolve region from sales channel
    if (salesChannelId) {
      try {
        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id", "currency_code"],
          filters: {},
        })
        // Find region matching the currency or country
        const matchedRegion = (regions || []).find((r: any) =>
          r.currency_code === currency_code
        )
        if (matchedRegion) {
          regionId = matchedRegion.id
        } else if (regions?.length > 0) {
          regionId = regions[0].id
        }
      } catch (e) {
        console.warn("[Create Order] Could not resolve region:", (e as Error).message)
      }
    }

    // Fallback: find any region/sales_channel
    if (!regionId) {
      try {
        const { data: regions } = await query.graph({
          entity: "region",
          fields: ["id"],
          filters: {},
        })
        if (regions?.length > 0) regionId = regions[0].id
      } catch {}
    }

    if (!salesChannelId) {
      try {
        const { data: channels } = await query.graph({
          entity: "sales_channel",
          fields: ["id"],
          filters: {},
        })
        if (channels?.length > 0) salesChannelId = channels[0].id
      } catch {}
    }

    if (!regionId || !salesChannelId) {
      res.status(500).json({ error: "Could not resolve region or sales channel" })
      return
    }

    // Build address
    const address = {
      first_name,
      last_name,
      address_1,
      address_2: address_2 || undefined,
      city,
      postal_code,
      country_code: country_code.toLowerCase(),
      phone: phone || undefined,
    }

    // Build items
    const items = [{
      title: product_title || "Order Item",
      variant_id: variant_id || undefined,
      quantity: Number(quantity),
      unit_price: Number(unit_price),
      is_tax_inclusive: true,
    }]

    // Build metadata
    const metadata: any = {
      created_by: "manual_ai_order_creator",
      created_manually: true,
      project_id: project_slug || undefined,
      copied_payment_status: payment_status,
    }

    if (payment_id) {
      // Detect payment provider from ID format
      if (payment_id.startsWith("int_")) {
        metadata.airwallexPaymentIntentId = payment_id
        metadata.payment_provider = "airwallex"
      } else if (payment_id.startsWith("tr_")) {
        metadata.molliePaymentId = payment_id
        metadata.payment_provider = "mollie"
      } else if (payment_id.startsWith("ord_")) {
        metadata.mollieOrderId = payment_id
        metadata.payment_provider = "mollie"
      } else if (payment_id.startsWith("pi_") || payment_id.startsWith("pm_") || payment_id.startsWith("cs_")) {
        metadata.stripePaymentIntentId = payment_id
        metadata.payment_provider = "stripe"
      } else if (payment_id.startsWith("P24")) {
        metadata.p24SessionId = payment_id
        metadata.payment_provider = "przelewy24"
      } else {
        // Fallback: store in both payment_id and payment_id_override so widget can read it
        metadata.payment_id = payment_id
        metadata.payment_id_override = payment_id
      }
    }

    if (payment_method) {
      metadata.payment_method = payment_method
    }

    if (shipping_method_type) {
      metadata.shipping_method = shipping_method_type
    }

    if (pickup_point_id) {
      metadata.pickup_point_id = pickup_point_id
      metadata.pickup_point_name = pickup_point_name || ""
    }

    if (notes) {
      metadata.manual_order_notes = notes
    }

    // Create order
    const newOrder = await orderModuleService.createOrders({
      currency_code: currency_code.toLowerCase(),
      email,
      region_id: regionId,
      sales_channel_id: salesChannelId,
      shipping_address: address,
      billing_address: address,
      items,
      shipping_methods: [{
        name: shipping_option_name || "Standard Shipping",
        amount: 0,
        ...(shipping_option_id && { shipping_option_id }),
      }],
      metadata,
    })

    const orderId = (newOrder as any).id
    const displayId = (newOrder as any).display_id

    // Generate custom order number
    const cc = country_code.toUpperCase()
    const year = new Date().getFullYear()
    const customOrderNumber = `${cc}${year}-${displayId}`

    await orderModuleService.updateOrders(orderId, {
      metadata: {
        ...metadata,
        custom_order_number: customOrderNumber,
      },
    })

    // Add tax lines (books have reduced VAT rates in most EU countries)
    try {
      const { data: [freshOrder] } = await query.graph({
        entity: "order",
        fields: ["items.id"],
        filters: { id: orderId },
      })
      const newItems = (freshOrder as any)?.items || []
      if (newItems.length > 0) {
        // Book VAT rates per country (reduced rates for physical books)
        const BOOK_VAT: Record<string, number> = {
          nl: 9, be: 6, de: 7, at: 10, se: 6, pl: 5, cz: 0, sk: 10,
          lu: 3, fr: 5, it: 4, es: 4, pt: 6, ie: 0, hu: 5,
        }
        const taxRate = BOOK_VAT[country_code.toLowerCase()] ?? 0

        await orderModuleService.createOrderLineItemTaxLines(
          orderId,
          [{
            item_id: newItems[0].id,
            code: "VAT",
            rate: taxRate,
            description: `VAT ${taxRate}%`,
          }]
        )
      }
    } catch (taxErr: any) {
      console.warn("[Create Order] Could not add tax lines:", taxErr.message)
    }

    console.log(`[Create Order] Created manual order ${orderId} → ${customOrderNumber} for ${email}`)

    res.json({
      success: true,
      order_id: orderId,
      display_id: displayId,
      custom_order_number: customOrderNumber,
    })
  } catch (error: any) {
    console.error("[Create Order] Error:", error)
    res.status(500).json({ error: error.message || "Failed to create order" })
  }
}
