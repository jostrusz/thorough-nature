import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService: IOrderModuleService = req.scope.resolve(Modules.ORDER)

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
        "billing_address.*",
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

    // Medusa v2 query.graph returns shipping_address with only { id } — resolve full addresses
    try {
      const addressService = (orderModuleService as any).orderAddressService_
      if (addressService) {
        const allIds: string[] = []
        for (const order of orders as any[]) {
          if (order.shipping_address?.id) allIds.push(order.shipping_address.id)
          if (order.billing_address?.id) allIds.push(order.billing_address.id)
        }
        const uniqueIds = [...new Set(allIds)]

        if (uniqueIds.length > 0) {
          // Try batch list first, fall back to individual retrieves
          let addressMap = new Map<string, any>()
          try {
            const addresses = await addressService.list({ id: uniqueIds })
            addressMap = new Map(addresses.map((a: any) => [a.id, a]))
          } catch {
            // Fallback: retrieve individually
            const results = await Promise.all(
              uniqueIds.map((id: string) =>
                addressService.retrieve(id).catch(() => null)
              )
            )
            for (const addr of results) {
              if (addr?.id) addressMap.set(addr.id, addr)
            }
          }

          for (const order of orders as any[]) {
            if (order.shipping_address?.id && addressMap.has(order.shipping_address.id)) {
              order.shipping_address = addressMap.get(order.shipping_address.id)
            }
            if (order.billing_address?.id && addressMap.has(order.billing_address.id)) {
              order.billing_address = addressMap.get(order.billing_address.id)
            }
          }
        }
      }
    } catch (addrErr: any) {
      console.warn("Could not resolve order addresses:", addrErr.message)
    }

    // Client-side filtering for metadata and country (Medusa doesn't support metadata filtering in query.graph)
    let filteredOrders = orders

    if (deliveryStatus) {
      if (deliveryStatus === "new" || deliveryStatus === "NEW") {
        // New orders = no dextrum_status set yet
        filteredOrders = filteredOrders.filter(
          (o: any) => !o.metadata?.dextrum_status
        )
      } else {
        filteredOrders = filteredOrders.filter(
          (o: any) => o.metadata?.dextrum_status === deliveryStatus
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
          (o.metadata?.tags && o.metadata.tags.toLowerCase().includes(q)) ||
          (o.metadata?.custom_order_number &&
            o.metadata.custom_order_number.toLowerCase().includes(q))
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
