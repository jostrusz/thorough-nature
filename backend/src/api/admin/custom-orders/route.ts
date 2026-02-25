import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const limit = parseInt(req.query.limit as string) || 20
    const offset = parseInt(req.query.offset as string) || 0
    const search = (req.query.q as string) || ""
    const deliveryStatus = (req.query.delivery_status as string) || ""
    const country = (req.query.country as string) || ""
    const paymentStatus = (req.query.payment_status as string) || ""
    const sortBy = (req.query.sort_by as string) || "created_at"
    const sortDir = (req.query.sort_dir as string) || "DESC"

    const filters: Record<string, any> = {}

    if (paymentStatus) {
      filters.payment_status = paymentStatus
    }

    const { data: orders, metadata } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "updated_at",
        "email",
        "currency_code",
        "total",
        "subtotal",
        "shipping_total",
        "tax_total",
        "status",
        "metadata",
        "items.*",
        "items.variant.*",
        "items.variant.product.*",
        "shipping_address.*",
        "fulfillments.*",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters,
      pagination: {
        skip: offset,
        take: limit,
        order: {
          [sortBy]: sortDir,
        },
      },
    })

    // Client-side filtering for metadata and country (Medusa doesn't support metadata filtering in query.graph)
    let filteredOrders = orders

    if (deliveryStatus) {
      if (deliveryStatus === "new") {
        // New orders = no baselinker_status set
        filteredOrders = filteredOrders.filter(
          (o: any) => !o.metadata?.baselinker_status || o.metadata?.baselinker_status === ""
        )
      } else {
        filteredOrders = filteredOrders.filter(
          (o: any) => o.metadata?.baselinker_status === deliveryStatus
        )
      }
    }

    if (country) {
      const countries = country.split(",").map((c) => c.trim().toUpperCase())
      filteredOrders = filteredOrders.filter((o: any) =>
        countries.includes(o.shipping_address?.country_code?.toUpperCase())
      )
    }

    if (search) {
      const q = search.toLowerCase()
      filteredOrders = filteredOrders.filter(
        (o: any) =>
          String(o.display_id).includes(q) ||
          (o.email && o.email.toLowerCase().includes(q)) ||
          (o.shipping_address?.first_name &&
            o.shipping_address.first_name.toLowerCase().includes(q)) ||
          (o.shipping_address?.last_name &&
            o.shipping_address.last_name.toLowerCase().includes(q)) ||
          (o.metadata?.tags && o.metadata.tags.toLowerCase().includes(q))
      )
    }

    res.json({
      orders: filteredOrders,
      count: (metadata as any)?.count ?? orders.length,
      filtered_count: filteredOrders.length,
    })
  } catch (error: any) {
    console.error("Custom orders list error:", error)
    res.status(500).json({ error: error.message || "Failed to fetch orders" })
  }
}
