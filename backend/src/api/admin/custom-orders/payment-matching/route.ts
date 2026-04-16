import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"

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
  amount_1: number
  amount_2: number | null
  total: number
  currency: string
  is_cod: boolean
  is_upsell: boolean
  status: "matched" | "missing_invoice" | "missing_payment_id"
}

function extractPaymentId(meta: any): string | null {
  return (
    meta?.payment_id_override ||
    meta?.molliePaymentId ||
    meta?.stripePaymentIntentId ||
    meta?.paypalOrderId ||
    meta?.comgateTransId ||
    meta?.p24SessionId ||
    meta?.airwallexPaymentIntentId ||
    meta?.klarnaOrderId ||
    meta?.novalnetTid ||
    meta?.payment_id ||
    null
  )
}

/**
 * Detect the payment GATEWAY (not method) for an order.
 * Priority:
 *   1. COD check (metadata + provider_id)
 *   2. Metadata keys set by order-placed-payment-metadata subscriber
 *   3. Pattern-based fallback on the extracted Payment ID (for legacy orders)
 * Returns one of: "airwallex" | "stripe" | "paypal" | "klarna" | "comgate" | "cod" | "mollie" | "przelewy24" | "unknown"
 */
function detectPaymentGateway(
  order: any,
  paymentId: string | null,
  isCod: boolean
): string {
  if (isCod) return "cod"

  const meta = order?.metadata || {}

  // 1. Explicit metadata from subscriber
  const explicit = (meta.payment_provider || "").toString().toLowerCase()
  const explicitMap: Record<string, string> = {
    airwallex: "airwallex",
    stripe: "stripe",
    paypal: "paypal",
    klarna: "klarna",
    comgate: "comgate",
    mollie: "mollie",
    przelewy24: "przelewy24",
    p24: "przelewy24",
    novalnet: "novalnet",
    cod: "cod",
  }
  if (explicitMap[explicit]) return explicitMap[explicit]

  // 2. Metadata keys set by subscriber
  if (meta.airwallexPaymentIntentId) return "airwallex"
  if (meta.stripePaymentIntentId || meta.stripeCheckoutSessionId) return "stripe"
  if (meta.paypalOrderId) return "paypal"
  if (meta.klarnaOrderId) return "klarna"
  if (meta.comgateTransId) return "comgate"
  if (meta.molliePaymentId || meta.mollieOrderId) return "mollie"
  if (meta.p24SessionId) return "przelewy24"
  if (meta.novalnetTid) return "novalnet"

  // 3. Payment collection provider_id
  const pcs = order?.payment_collections || []
  for (const pc of pcs) {
    for (const p of pc.payments || []) {
      const pid = (p.provider_id || "").toLowerCase()
      if (pid.includes("airwallex")) return "airwallex"
      if (pid.includes("stripe")) return "stripe"
      if (pid.includes("paypal")) return "paypal"
      if (pid.includes("klarna")) return "klarna"
      if (pid.includes("comgate")) return "comgate"
      if (pid.includes("mollie")) return "mollie"
      if (pid.includes("przelewy") || pid.includes("p24")) return "przelewy24"
      if (pid.includes("novalnet")) return "novalnet"
    }
  }

  // 4. Pattern-based fallback on Payment ID (legacy orders)
  if (paymentId) {
    if (/^int_/i.test(paymentId)) return "airwallex"
    if (/^(pi|pm|cs|ch|py)_/i.test(paymentId)) return "stripe"
    if (/^tr_|^ord_/i.test(paymentId)) return "mollie"
    if (/^P24/i.test(paymentId)) return "przelewy24"
    // Klarna: UUID v4-ish format
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(paymentId)) return "klarna"
    // PayPal capture: 17 uppercase alphanumeric chars
    if (/^[A-Z0-9]{17}$/.test(paymentId)) return "paypal"
    // Novalnet TID: exactly 17 digits (must come BEFORE Comgate's \d{6,12} check)
    if (/^\d{17}$/.test(paymentId)) return "novalnet"
    // Comgate: short alphanumeric code with dashes (e.g. ABCD-EFGH-1234) or pure numeric
    if (/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/i.test(paymentId)) return "comgate"
    if (/^\d{6,12}$/.test(paymentId)) return "comgate"
  }

  return "unknown"
}

function isCodOrder(order: any): boolean {
  const meta = order.metadata || {}
  if (meta.payment_provider === "cod" || meta.payment_method === "cod") return true
  const pcs = order.payment_collections || []
  return pcs.some((pc: any) =>
    (pc.payments || []).some((p: any) => (p.provider_id || "").includes("cod"))
  )
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService: IOrderModuleService = req.scope.resolve(Modules.ORDER)

    const limit = parseInt(req.query.limit as string) || 100
    const offset = parseInt(req.query.offset as string) || 0
    const from = (req.query.from as string) || ""
    const to = (req.query.to as string) || ""
    const project = (req.query.project as string) || ""
    const paymentMethodFilter = (req.query.payment_method as string) || ""
    const statusFilter = (req.query.status as string) || ""

    // Build date filters
    const filters: Record<string, any> = {}
    if (from || to) {
      filters.created_at = {}
      if (from) filters.created_at.$gte = new Date(from).toISOString()
      if (to) {
        const toDate = new Date(to)
        toDate.setDate(toDate.getDate() + 1) // Include the full 'to' day
        filters.created_at.$lt = toDate.toISOString()
      }
    }

    const { data: orders, metadata: paginationMeta } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "email",
        "currency_code",
        "total",
        "subtotal",
        "metadata",
        "shipping_address.*",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters,
      pagination: {
        skip: offset,
        take: limit,
        order: { created_at: "DESC" },
      },
    })

    // Resolve shipping addresses
    const addressCache: Record<string, any> = {}
    for (const order of orders) {
      if ((order as any).shipping_address?.id) {
        const addrId = (order as any).shipping_address.id
        if (!addressCache[addrId]) {
          try {
            addressCache[addrId] = await (
              orderModuleService as any
            ).orderAddressService_.retrieve(addrId)
          } catch {
            addressCache[addrId] = (order as any).shipping_address
          }
        }
      }
    }

    // Build rows
    const rows: PaymentMatchRow[] = []

    for (const order of orders) {
      const meta = (order as any).metadata || {}
      const addr = (order as any).shipping_address?.id
        ? addressCache[(order as any).shipping_address.id] || (order as any).shipping_address
        : null

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
        // Fallback: try payment.data from payment collections
        if (!paymentId1) {
          const payments = ((order as any).payment_collections || [])
            .flatMap((pc: any) => pc.payments || [])
          for (const payment of payments) {
            // PayPal: captureId is the bank transaction reference
            if (payment.data?.captureId) {
              paymentId1 = String(payment.data.captureId)
              break
            }
            if (payment.data?.intentId) {
              paymentId1 = String(payment.data.intentId)
              break
            }
            if (payment.data?.klarnaOrderId) {
              paymentId1 = String(payment.data.klarnaOrderId)
              break
            }
            if (payment.data?.paypalOrderId) {
              paymentId1 = String(payment.data.paypalOrderId)
              break
            }
            if (payment.data?.comgateTransId) {
              paymentId1 = String(payment.data.comgateTransId)
              break
            }
            if (payment.data?.id) {
              paymentId1 = String(payment.data.id)
              break
            }
            if (payment.data?.payment_intent) {
              paymentId1 = String(payment.data.payment_intent)
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
      count: (paginationMeta as any)?.count || rows.length,
    })
  } catch (error: any) {
    console.error("[PaymentMatching] Error:", error)
    res.status(500).json({ error: error.message })
  }
}
