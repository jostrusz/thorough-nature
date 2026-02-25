import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { action, order_ids, payload } = req.body as {
      action: string
      order_ids: string[]
      payload?: Record<string, any>
    }

    if (!action || !order_ids || !Array.isArray(order_ids) || order_ids.length === 0) {
      res.status(400).json({ error: "action and order_ids are required" })
      return
    }

    const orderModuleService = req.scope.resolve(Modules.ORDER)
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    switch (action) {
      case "update_metadata": {
        if (!payload?.metadata) {
          res.status(400).json({ error: "payload.metadata is required for update_metadata action" })
          return
        }

        const results = []
        for (const orderId of order_ids) {
          try {
            // Fetch existing metadata
            const { data: [order] } = await query.graph({
              entity: "order",
              fields: ["id", "metadata"],
              filters: { id: orderId },
            })

            if (order) {
              const mergedMetadata = {
                ...((order as any).metadata || {}),
                ...payload.metadata,
              }

              await orderModuleService.updateOrders(orderId, {
                metadata: mergedMetadata,
              })
              results.push({ id: orderId, success: true })
            } else {
              results.push({ id: orderId, success: false, error: "Not found" })
            }
          } catch (err: any) {
            results.push({ id: orderId, success: false, error: err.message })
          }
        }

        res.json({ success: true, action, results })
        return
      }

      case "export": {
        // Fetch orders for export
        const { data: orders } = await query.graph({
          entity: "order",
          fields: [
            "id",
            "display_id",
            "created_at",
            "email",
            "total",
            "currency_code",
            "metadata",
            "shipping_address.*",
            "items.*",
            "items.variant.product.title",
          ],
          filters: { id: order_ids },
        })

        // Generate CSV
        const csvHeaders = [
          "Order",
          "Date",
          "Customer",
          "Email",
          "Total",
          "Currency",
          "Country",
          "Tag",
          "Delivery Status",
          "Book Sent",
          "Items",
        ].join(",")

        const csvRows = (orders as any[]).map((o) => {
          const name = [
            o.shipping_address?.first_name || "",
            o.shipping_address?.last_name || "",
          ]
            .filter(Boolean)
            .join(" ")
          const items = o.items?.length || 0
          return [
            `#${o.display_id}`,
            new Date(o.created_at).toISOString().split("T")[0],
            `"${name}"`,
            o.email || "",
            o.total,
            o.currency_code?.toUpperCase() || "EUR",
            o.shipping_address?.country_code?.toUpperCase() || "",
            `"${o.metadata?.tags || ""}"`,
            o.metadata?.baselinker_status || "",
            o.metadata?.book_sent ? "Yes" : "No",
            items,
          ].join(",")
        })

        const csv = [csvHeaders, ...csvRows].join("\n")

        res.json({
          success: true,
          action: "export",
          csv,
          count: orders.length,
        })
        return
      }

      default:
        res.status(400).json({ error: `Unknown action: ${action}` })
        return
    }
  } catch (error: any) {
    console.error("Bulk action error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to execute bulk action" })
  }
}
