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
        "id", "display_id", "email", "created_at",
        "shipping_address.*",
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
