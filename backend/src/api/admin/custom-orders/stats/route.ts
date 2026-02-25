import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Fetch all orders (we'll compute stats client-side from recent orders)
    const { data: allOrders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "created_at",
        "total",
        "currency_code",
        "metadata",
        "fulfillments.id",
      ],
      pagination: {
        take: 500,
        order: { created_at: "DESC" },
      },
    })

    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const yesterdayStart = new Date(todayStart)
    yesterdayStart.setDate(yesterdayStart.getDate() - 1)

    let ordersToday = 0
    let revenueToday = 0
    let ordersYesterday = 0
    let revenueYesterday = 0
    let unfulfilled = 0
    let inTransit = 0

    for (const order of allOrders as any[]) {
      const createdAt = new Date(order.created_at)
      const total = Number(order.total) || 0

      // Today
      if (createdAt >= todayStart) {
        ordersToday++
        revenueToday += total
      }

      // Yesterday
      if (createdAt >= yesterdayStart && createdAt < todayStart) {
        ordersYesterday++
        revenueYesterday += total
      }

      // Unfulfilled = no fulfillments
      const hasFulfillments =
        order.fulfillments && order.fulfillments.length > 0
      if (!hasFulfillments) {
        unfulfilled++
      }

      // In Transit
      if (order.metadata?.baselinker_status === "transit") {
        inTransit++
      }
    }

    res.json({
      ordersToday,
      revenueToday: Math.round(revenueToday * 100) / 100,
      ordersYesterday,
      revenueYesterday: Math.round(revenueYesterday * 100) / 100,
      unfulfilled,
      inTransit,
    })
  } catch (error: any) {
    console.error("Order stats error:", error)
    res.status(500).json({ error: error.message || "Failed to fetch stats" })
  }
}
