import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { action, order_ids, payload, date_from, date_to } = req.body as {
      action: string
      order_ids?: string[]
      payload?: Record<string, any>
      date_from?: string
      date_to?: string
    }

    if (!action) {
      res.status(400).json({ error: "action is required" })
      return
    }

    // For export, allow either order_ids or date range
    if (action !== "export" && (!order_ids || !Array.isArray(order_ids) || order_ids.length === 0)) {
      res.status(400).json({ error: "order_ids are required for this action" })
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
        // Build filters: either by order_ids or date range
        const exportFilters: Record<string, any> = {}
        if (order_ids && order_ids.length > 0) {
          exportFilters.id = order_ids
        } else if (date_from || date_to) {
          exportFilters.created_at = {}
          if (date_from) exportFilters.created_at.$gte = new Date(date_from).toISOString()
          if (date_to) {
            const endDate = new Date(date_to)
            endDate.setHours(23, 59, 59, 999)
            exportFilters.created_at.$lte = endDate.toISOString()
          }
        } else {
          res.status(400).json({ error: "Either order_ids or date_from/date_to is required for export" })
          return
        }

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
            "payment_collections.payments.data",
            "payment_collections.payments.provider_id",
          ],
          filters: exportFilters,
        })

        // Generate CSV
        const csvHeaders = [
          "Order",
          "Date",
          "Customer",
          "Email",
          "Total",
          "Currency",
          "Address",
          "Postal Code",
          "Country",
          "Phone",
          "Company",
          "Tag",
          "Delivery Status",
          "Payment ID",
          "Fakturoid Invoice",
          "QuickBooks Invoice",
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
          const address = [o.shipping_address?.address_1, o.shipping_address?.city].filter(Boolean).join(", ")
          // Extract payment ID from metadata or payment collections
          const meta = o.metadata || {}
          let paymentId =
            meta.paypal_transaction_id ||
            meta.molliePaymentId ||
            meta.stripePaymentIntentId ||
            meta.paypalOrderId ||
            meta.comgateTransId ||
            meta.p24SessionId ||
            meta.airwallexPaymentIntentId ||
            meta.klarnaOrderId ||
            meta.payment_id ||
            ""
          if (!paymentId) {
            const payments = (o.payment_collections || [])
              .flatMap((pc: any) => pc.payments || [])
            for (const payment of payments) {
              if (payment.data?.intentId) {
                paymentId = String(payment.data.intentId)
                break
              }
              if (payment.data?.klarnaOrderId) {
                paymentId = String(payment.data.klarnaOrderId)
                break
              }
              if (payment.data?.paypalOrderId) {
                paymentId = String(payment.data.paypalOrderId)
                break
              }
              if (payment.data?.comgateTransId) {
                paymentId = String(payment.data.comgateTransId)
                break
              }
              if (payment.data?.id) {
                paymentId = String(payment.data.id)
                break
              }
              if (payment.data?.payment_intent) {
                paymentId = String(payment.data.payment_intent)
                break
              }
            }
          }
          return [
            `#${o.display_id}`,
            new Date(o.created_at).toISOString().split("T")[0],
            `"${name}"`,
            o.email || "",
            o.total,
            o.currency_code?.toUpperCase() || "EUR",
            `"${address}"`,
            o.shipping_address?.postal_code || "",
            o.shipping_address?.country_code?.toUpperCase() || "",
            o.shipping_address?.phone || "",
            `"${o.shipping_address?.company || ""}"`,
            `"${o.metadata?.tags || ""}"`,
            o.metadata?.dextrum_status || "",
            paymentId,
            o.metadata?.fakturoid_invoice_id || "",
            o.metadata?.quickbooks_invoice_id || "",
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

      case "delete": {
        const results = []
        for (const orderId of order_ids) {
          try {
            await orderModuleService.deleteOrders([orderId])
            results.push({ id: orderId, success: true })
          } catch (err: any) {
            results.push({ id: orderId, success: false, error: err.message })
          }
        }

        res.json({ success: true, action: "delete", results, count: results.filter(r => r.success).length })
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
