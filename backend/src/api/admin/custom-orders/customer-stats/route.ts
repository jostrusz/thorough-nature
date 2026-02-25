import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const email = req.query.email as string

    if (!email) {
      res.status(400).json({ error: "email query parameter is required" })
      return
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    const { data: orders, metadata } = await query.graph({
      entity: "order",
      fields: ["id", "total", "created_at", "currency_code"],
      filters: { email },
      pagination: {
        take: 500,
      },
    })

    const totalSpent = (orders as any[]).reduce(
      (sum, o) => sum + (Number(o.total) || 0),
      0
    )

    const currency = (orders as any[])[0]?.currency_code || "eur"

    res.json({
      email,
      order_count: (metadata as any)?.count ?? orders.length,
      total_spent: Math.round(totalSpent * 100) / 100,
      currency,
    })
  } catch (error: any) {
    console.error("Customer stats error:", error)
    res.status(500).json({ error: error.message || "Failed to fetch customer stats" })
  }
}
