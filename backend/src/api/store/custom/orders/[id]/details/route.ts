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
        "id", "display_id", "email", "created_at", "currency_code",
        "total", "subtotal", "tax_total", "shipping_total", "discount_total",
        "shipping_address.*",
        "items.id", "items.title", "items.product_title", "items.variant_title",
        "items.variant_sku", "items.quantity", "items.unit_price", "items.total",
        "items.thumbnail",
      ],
      filters: { id: orderId },
    })

    if (!orders.length) {
      res.status(404).json({ success: false, message: "Order not found" })
      return
    }

    const order = orders[0] as any
    const sa = order.shipping_address || {}

    res.json({
      success: true,
      order: {
        id: order.id,
        display_id: order.display_id,
        email: order.email,
        currency_code: order.currency_code,
        total: Number(order.total) || 0,
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
          quantity: i.quantity,
          unit_price: Number(i.unit_price) || 0,
          total: Number(i.total) || 0,
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
