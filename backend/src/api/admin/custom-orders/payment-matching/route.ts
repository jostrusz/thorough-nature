import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { buildDateFilters, fetchAllOrders } from "./fetch-all-orders"
import {
  extractPaymentId,
  extractPaymentIdFromPaymentData,
  detectPaymentGateway,
  isCodOrder,
} from "./provider-detect"

/**
 * GET /admin/custom-orders/payment-matching
 *
 * Returns orders with payment-matching data:
 * order number, invoice number (VS), Payment ID 1, Payment ID 2 (upsell),
 * amounts, dates, customer, currency, payment method.
 *
 * Query params: from, to, project, payment_method, status, limit, offset
 */

interface PaymentMatchRow {
  order_id: string
  order_number: string
  display_id: number
  date: string
  customer_name: string
  customer_email: string
  invoice_number: string | null
  fakturoid_invoice_url: string | null
  payment_id_1: string | null
  payment_id_2: string | null
  payment_method: string
  payment_provider: string
  payment_method_raw: string | null
  amount_1: number
  amount_2: number | null
  total: number
  currency: string
  is_cod: boolean
  is_upsell: boolean
  status: "matched" | "missing_invoice" | "missing_payment_id"
}


export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const from = (req.query.from as string) || ""
    const to = (req.query.to as string) || ""
    const project = (req.query.project as string) || ""
    const paymentMethodFilter = (req.query.payment_method as string) || ""
    const statusFilter = (req.query.status as string) || ""

    // Fetch ALL orders in the date range (paginated, no fixed cap)
    const filters = buildDateFilters(from, to)
    const orders = await fetchAllOrders(req.scope, filters, "DESC")

    // Build rows
    const rows: PaymentMatchRow[] = []

    for (const order of orders) {
      const meta = (order as any).metadata || {}
      const addr = (order as any).shipping_address || null

      // Project filter
      if (project && meta.project_id !== project) continue

      const cod = isCodOrder(order as any)
      const orderNumber = meta.custom_order_number ||
        ((order as any).display_id ? `ORD-${(order as any).display_id}` : (order as any).id)

      // Payment ID 1
      let paymentId1: string | null = null
      if (cod) {
        // COD: Payment ID = invoice number (fakturoid_invoice_id)
        paymentId1 = meta.fakturoid_invoice_id || null
      } else {
        paymentId1 = extractPaymentId(meta)
        // Fallback: try payment.data from payment collections (covers all gateways
        // incl. payu/brite/barion/revolut via the shared helper)
        if (!paymentId1) {
          const payments = ((order as any).payment_collections || [])
            .flatMap((pc: any) => pc.payments || [])
          for (const payment of payments) {
            const pid = extractPaymentIdFromPaymentData(payment.data)
            if (pid) {
              paymentId1 = pid
              break
            }
          }
        }
      }

      // Payment ID 2 (upsell or secondary transaction ID)
      let paymentId2: string | null = null
      const upsellPaymentId = meta.upsell_payment_id
      const isUpsell = !!meta.upsell_accepted && !!upsellPaymentId
      if (isUpsell && upsellPaymentId !== "cod" && upsellPaymentId !== "extraction_failed") {
        paymentId2 = upsellPaymentId
      }
      // If no upsell payment_id_2, fill with secondary transaction ID from payment.data
      if (!paymentId2 && !cod) {
        const payments = ((order as any).payment_collections || [])
          .flatMap((pc: any) => pc.payments || [])
        for (const payment of payments) {
          const d = payment.data || {}
          // Collect all available IDs
          const candidates = [
            d.captureId,
            d.id,
            d.intentId,
            d.paypalOrderId,
            d.klarnaOrderId,
            d.comgateTransId,
            d.payuOrderId,
            d.briteSessionId,
            d.barionPaymentId,
            d.revolutOrderId,
            d.payment_intent,
            d.transaction_id,
          ].filter(Boolean).map(String)
          // Pick the first one that differs from paymentId1
          const secondary = candidates.find((c) => c !== paymentId1)
          if (secondary) {
            paymentId2 = secondary
            break
          }
        }
      }

      // Invoice number
      const invoiceNumber = meta.fakturoid_invoice_id ||
        meta.fakturoid_invoice_number ||
        meta.quickbooks_invoice_number ||
        null

      // Payment gateway (brána) — detected from metadata, provider_id, or Payment ID pattern
      const paymentGateway = detectPaymentGateway(order as any, paymentId1, cod)
      // Kept for backwards compatibility; now holds the gateway, not the payment method
      const paymentMethod = paymentGateway
      // The actual payment METHOD (card, ideal, blik, comgate/payu bank code, klarna
      // variant, …) — rendered into a human label on the frontend via getPaymentMethodName.
      const paymentMethodRaw = cod ? "cod" : (meta.payment_method || null)

      // Payment gateway filter
      if (paymentMethodFilter) {
        if (paymentMethodFilter === "cod" && !cod) continue
        if (paymentMethodFilter !== "cod" && paymentGateway !== paymentMethodFilter) continue
      }

      // Customer name
      const customerName = addr
        ? [addr.first_name, addr.last_name].filter(Boolean).join(" ")
        : meta.company_name || (order as any).email || ""

      // Amount calculation (Medusa v2 stores totals in decimal, not cents)
      const totalAmount = Number((order as any).total) || 0

      // For upsell: try to calculate upsell amount from metadata
      let amount1 = totalAmount
      let amount2: number | null = null
      if (isUpsell && meta.upsell_amount) {
        amount2 = Number(meta.upsell_amount)
        amount1 = totalAmount - (amount2 || 0)
      } else if (isUpsell) {
        // Estimate: we don't have exact split, show total as amount1
        amount1 = totalAmount
        amount2 = null
      }

      // Status
      let status: PaymentMatchRow["status"] = "matched"
      if (!invoiceNumber) status = "missing_invoice"
      else if (!paymentId1 && !cod) status = "missing_payment_id"

      // Status filter
      if (statusFilter) {
        if (statusFilter === "matched" && status !== "matched") continue
        if (statusFilter === "missing_invoice" && status !== "missing_invoice") continue
        if (statusFilter === "missing_payment_id" && status !== "missing_payment_id") continue
        if (statusFilter === "upsell" && !isUpsell) continue
        if (statusFilter === "cod" && !cod) continue
      }

      rows.push({
        order_id: (order as any).id,
        order_number: orderNumber,
        display_id: (order as any).display_id || 0,
        date: (order as any).created_at,
        customer_name: customerName,
        customer_email: (order as any).email || "",
        invoice_number: invoiceNumber,
        fakturoid_invoice_url: meta.fakturoid_invoice_url || null,
        payment_id_1: paymentId1,
        payment_id_2: paymentId2,
        payment_method: paymentMethod,
        payment_provider: paymentGateway,
        payment_method_raw: paymentMethodRaw,
        amount_1: amount1,
        amount_2: amount2,
        total: totalAmount,
        currency: ((order as any).currency_code || "EUR").toUpperCase(),
        is_cod: cod,
        is_upsell: isUpsell,
        status,
      })
    }

    // Compute stats
    const stats = {
      total_orders: rows.length,
      matched: rows.filter((r) => r.status === "matched").length,
      missing_invoice: rows.filter((r) => r.status === "missing_invoice").length,
      missing_payment_id: rows.filter((r) => r.status === "missing_payment_id").length,
      upsell: rows.filter((r) => r.is_upsell).length,
      cod: rows.filter((r) => r.is_cod).length,
      total_amount_by_currency: {} as Record<string, number>,
    }

    for (const row of rows) {
      stats.total_amount_by_currency[row.currency] =
        (stats.total_amount_by_currency[row.currency] || 0) + row.total
    }

    res.json({
      rows,
      stats,
      count: rows.length,
    })
  } catch (error: any) {
    console.error("[PaymentMatching] Error:", error)
    res.status(500).json({ error: error.message })
  }
}
