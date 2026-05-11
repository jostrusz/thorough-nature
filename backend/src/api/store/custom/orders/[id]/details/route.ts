// @ts-nocheck
import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const { id: orderId } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id", "display_id", "custom_display_id", "email", "created_at", "currency_code", "metadata",
        "total", "subtotal", "tax_total", "shipping_total", "discount_total",
        "summary.*",
        "shipping_address.*",
        "items.id", "items.title", "items.product_title", "items.variant_title",
        "items.variant_sku", "items.quantity", "items.unit_price", "items.total",
        "items.thumbnail",
        // quantity lives on the order_item join row in Medusa v2, not on the line_item —
        // request both so the fallback (i.detail?.quantity ?? i.quantity) always resolves
        "items.detail.quantity",
      ],
      filters: { id: orderId },
    })

    if (!orders.length) {
      res.status(404).json({ success: false, message: "Order not found" })
      return
    }

    const order = orders[0] as any
    const sa = order.shipping_address || {}

    // Medusa v2's order.total is unreliable: it can be 0 (computed field
    // doesn't resolve), OR it can over-apply region tax on top of a unit_price
    // that was already marked is_tax_inclusive=true (seen for BE 6% — €36
    // stored tax-inclusive surfaces back as €38.16). order_summary stores the
    // authoritative final amount that matches the captured payment, so prefer
    // that first. Fall back through computed → items only when summary missing.
    const summaryRaw = order?.summary
    const summaryRow = Array.isArray(summaryRaw) ? summaryRaw[summaryRaw.length - 1] : summaryRaw
    const summaryTotal =
        Number(summaryRow?.totals?.current_order_total)
      || Number(summaryRow?.current_order_total)
      || 0
    const computed = (Number(order.subtotal) || 0)
                   + (Number(order.tax_total) || 0)
                   + (Number(order.shipping_total) || 0)
                   - (Number(order.discount_total) || 0)
    const itemQty = (i: any) => Number(i?.detail?.quantity ?? i?.quantity) || 0
    const itemsTotal = (order.items || []).reduce(
      (sum: number, i: any) =>
        sum + (Number(i.total) || (Number(i.unit_price) || 0) * itemQty(i)),
      0
    )
    const totalResolved = summaryTotal || Number(order.total) || computed || itemsTotal || 0

    res.json({
      success: true,
      order: {
        id: order.id,
        display_id: order.display_id,
        custom_display_id: order.custom_display_id || (order.metadata && order.metadata.custom_order_number) || null,
        email: order.email,
        currency_code: order.currency_code,
        total: totalResolved,
        subtotal: Number(order.subtotal) || 0,
        tax_total: Number(order.tax_total) || 0,
        shipping_total: Number(order.shipping_total) || 0,
        discount_total: Number(order.discount_total) || 0,
        items: (order.items || []).map((i: any) => ({
          id: i.id,
          title: i.title,
          product_title: i.product_title,
          variant_title: i.variant_title,
          sku: i.variant_sku,
          quantity: itemQty(i),
          unit_price: Number(i.unit_price) || 0,
          total: Number(i.total) || (Number(i.unit_price) || 0) * itemQty(i),
          thumbnail: i.thumbnail,
        })),
        shipping_address: {
          first_name: sa.first_name || "",
          last_name: sa.last_name || "",
          address_1: sa.address_1 || "",
          city: sa.city || "",
          postal_code: sa.postal_code || "",
          country_code: sa.country_code || "",
          phone: sa.phone || "",
          company: sa.company || "",
        },
      },
    })
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message })
  }
}
