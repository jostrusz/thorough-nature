import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"

// Compute payment status from order data (same logic as frontend orders-table.tsx)
function getPaymentStatus(order: any): string {
  if (order.metadata?.payment_captured) return "paid"

  const isCOD = (order.payment_collections || []).some((pc: any) =>
    (pc.payments || []).some((p: any) => (p.provider_id || "").includes("cod"))
  ) || order.metadata?.payment_provider === "cod" || order.metadata?.payment_method === "cod"
  if (isCOD) return "pending"

  if (order.payment_collections?.length) {
    const pcs = order.payment_collections as any[]
    const activePC = pcs.find((pc: any) =>
      pc.status === "captured" || pc.status === "completed"
    ) || pcs.find((pc: any) =>
      pc.status !== "canceled"
    ) || pcs[pcs.length - 1]

    if (activePC.status === "captured" || activePC.status === "completed") return "paid"
    if (activePC.status === "refunded") return "refunded"
    if (activePC.status === "partially_refunded") return "partially_refunded"
    if (activePC.status === "authorized") return "authorized"
    return activePC.status || "pending"
  }
  if (order.metadata?.copied_payment_status) return order.metadata.copied_payment_status
  return "pending"
}

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

    // Medusa v2 query.graph returns shipping_address as null — resolve via orderModuleService
    try {
      const orderIds = (orders as any[]).map((o: any) => o.id)
      if (orderIds.length > 0) {
        // Step 1: Get orders with address relations (returns address as { id: "..." })
        const ordersWithRels = await orderModuleService.listOrders(
          { id: orderIds },
          { relations: ["shipping_address", "billing_address"], select: ["id"] }
        )

        // Step 2: Collect all address IDs
        const addressIds: string[] = []
        for (const o of ordersWithRels as any[]) {
          if (o.shipping_address?.id) addressIds.push(o.shipping_address.id)
          if (o.billing_address?.id) addressIds.push(o.billing_address.id)
        }
        const uniqueAddrIds = [...new Set(addressIds)]

        // Step 3: Fetch full address data via orderAddressService_
        if (uniqueAddrIds.length > 0) {
          const addressService = (orderModuleService as any).orderAddressService_
          let addressMap = new Map<string, any>()

          if (addressService) {
            try {
              // Try batch list
              const addresses = await addressService.list({ id: uniqueAddrIds })
              addressMap = new Map(addresses.map((a: any) => [a.id, a]))
            } catch {
              // Fallback: retrieve individually
              const results = await Promise.all(
                uniqueAddrIds.map((id: string) =>
                  addressService.retrieve(id).catch(() => null)
                )
              )
              for (const addr of results) {
                if (addr?.id) addressMap.set(addr.id, addr)
              }
            }
          }

          // Step 4: Map addresses back to query.graph orders
          const relMap = new Map<string, any>()
          for (const o of ordersWithRels as any[]) {
            relMap.set(o.id, {
              shipping_id: o.shipping_address?.id,
              billing_id: o.billing_address?.id,
            })
          }

          for (const order of orders as any[]) {
            const rel = relMap.get(order.id)
            if (rel?.shipping_id && addressMap.has(rel.shipping_id)) {
              order.shipping_address = addressMap.get(rel.shipping_id)
            }
            if (rel?.billing_id && addressMap.has(rel.billing_id)) {
              order.billing_address = addressMap.get(rel.billing_id)
            }
          }
        }
      }
    } catch (addrErr: any) {
      console.warn("Could not resolve order addresses:", addrErr.message)
    }

    // Client-side filtering (Medusa query.graph doesn't support metadata/computed field filtering)
    let filteredOrders = orders

    if (paymentStatus) {
      filteredOrders = filteredOrders.filter(
        (o: any) => getPaymentStatus(o) === paymentStatus
      )
    }

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

    // Strip html_body from email_activity_log to keep list response lean
    // (html_body is only needed on the order detail page, not the list)
    for (const o of filteredOrders as any[]) {
      if (o.metadata?.email_activity_log) {
        o.metadata.email_activity_log = o.metadata.email_activity_log.map(
          (entry: any) => {
            const { html_body, ...rest } = entry
            return rest
          }
        )
      }
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
