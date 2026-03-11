import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"

/**
 * GET /admin/custom-orders/payment-matching/export
 *
 * Exports payment matching data as CSV in GPC format.
 * Windows-1250 encoding, semicolon separator.
 *
 * Query params: from, to, project, account_number, account_name
 */

function extractPaymentId(meta: any): string | null {
  return (
    meta?.molliePaymentId ||
    meta?.stripePaymentIntentId ||
    meta?.paypalOrderId ||
    meta?.comgateTransId ||
    meta?.p24SessionId ||
    meta?.airwallexPaymentIntentId ||
    meta?.klarnaOrderId ||
    null
  )
}

function isCodOrder(order: any): boolean {
  const meta = order.metadata || {}
  if (meta.payment_provider === "cod" || meta.payment_method === "cod") return true
  const pcs = order.payment_collections || []
  return pcs.some((pc: any) =>
    (pc.payments || []).some((p: any) => (p.provider_id || "").includes("cod"))
  )
}

function formatDate(isoDate: string): string {
  const d = new Date(isoDate)
  const dd = String(d.getDate()).padStart(2, "0")
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const yyyy = d.getFullYear()
  return `${dd}.${mm}.${yyyy}`
}

function formatAmount(cents: number): string {
  const amount = cents / 100
  return amount.toFixed(2).replace(".", ",")
}

function stripDiacritics(str: string): string {
  // Simple ASCII transliteration for GPC compatibility
  const map: Record<string, string> = {
    "á": "a", "č": "c", "ď": "d", "é": "e", "ě": "e", "í": "i",
    "ň": "n", "ó": "o", "ř": "r", "š": "s", "ť": "t", "ú": "u",
    "ů": "u", "ý": "y", "ž": "z", "Á": "A", "Č": "C", "Ď": "D",
    "É": "E", "Ě": "E", "Í": "I", "Ň": "N", "Ó": "O", "Ř": "R",
    "Š": "S", "Ť": "T", "Ú": "U", "Ů": "U", "Ý": "Y", "Ž": "Z",
    "ö": "o", "ü": "u", "ä": "a", "ß": "ss", "Ö": "O", "Ü": "U", "Ä": "A",
    "ł": "l", "ś": "s", "ź": "z", "ż": "z", "ć": "c", "ń": "n",
    "Ł": "L", "Ś": "S", "Ź": "Z", "Ż": "Z", "Ć": "C", "Ń": "N",
    "å": "a", "Å": "A", "ø": "o", "Ø": "O", "æ": "ae", "Æ": "AE",
  }
  return str.replace(/[^\x00-\x7F]/g, (ch) => map[ch] || ch)
}

export async function GET(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const queryService = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService: IOrderModuleService = req.scope.resolve(Modules.ORDER)

    const from = (req.query.from as string) || ""
    const to = (req.query.to as string) || ""
    const project = (req.query.project as string) || ""
    const accountNumber = (req.query.account_number as string) || ""
    const accountName = (req.query.account_name as string) || "PMS s.r.o."

    // Build date filters
    const filters: Record<string, any> = {}
    if (from || to) {
      filters.created_at = {}
      if (from) filters.created_at.$gte = new Date(from).toISOString()
      if (to) {
        const toDate = new Date(to)
        toDate.setDate(toDate.getDate() + 1)
        filters.created_at.$lt = toDate.toISOString()
      }
    }

    // Fetch all orders in the period (up to 5000)
    const { data: orders } = await queryService.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "email",
        "currency_code",
        "total",
        "metadata",
        "shipping_address.*",
        "payment_collections.*",
        "payment_collections.payments.*",
      ],
      filters,
      pagination: {
        skip: 0,
        take: 5000,
        order: { created_at: "ASC" },
      },
    })

    // Resolve addresses
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

    // Period start date for "Datum starého zůstatku"
    const periodStart = from ? formatDate(new Date(from).toISOString()) : formatDate(new Date().toISOString())

    // CSV header
    const header = [
      "Cislo uctu",
      "Nazev uctu",
      "Cislo protiuctu",
      "Id transakce (cislo,reference)",
      "Zauctovana castka",
      "Variabilni symbol",
      "Kod banky protistrany",
      "Konstantni symbol",
      "Specificky symbol",
      "Datum zauctovani",
      "Nazev protistrany",
      "Mena",
      "Datum stareho zustatku",
      "Stary zustatek",
      "Novy zustatek",
      "Poznamka",
      "Obraty DEBET",
      "Obraty KREDIT",
      "Iban protistrany",
    ].join(";")

    // Build CSV rows
    const csvRows: string[] = [header]
    let runningBalance = 0

    for (const order of orders) {
      const meta = (order as any).metadata || {}

      // Project filter
      if (project && meta.project_id !== project) continue

      const cod = isCodOrder(order as any)
      const addr = (order as any).shipping_address?.id
        ? addressCache[(order as any).shipping_address.id] || (order as any).shipping_address
        : null

      const orderNumber = meta.custom_order_number ||
        ((order as any).display_id ? `ORD-${(order as any).display_id}` : (order as any).id)

      const invoiceNumber = meta.fakturoid_invoice_id ||
        meta.fakturoid_invoice_number ||
        meta.quickbooks_invoice_number ||
        ""

      const paymentMethod = meta.payment_method || meta.payment_provider || ""
      const currency = ((order as any).currency_code || "EUR").toUpperCase()
      const totalCents = (order as any).total || 0

      const customerName = addr
        ? stripDiacritics([addr.first_name, addr.last_name].filter(Boolean).join(" "))
        : stripDiacritics(meta.company_name || "")

      const dateStr = formatDate((order as any).created_at)

      // Payment ID 1
      let paymentId1 = ""
      if (cod) {
        paymentId1 = invoiceNumber
      } else {
        paymentId1 = extractPaymentId(meta) || ""
        if (!paymentId1) {
          const payments = ((order as any).payment_collections || [])
            .flatMap((pc: any) => pc.payments || [])
          for (const payment of payments) {
            if (payment.data?.id) { paymentId1 = String(payment.data.id); break }
            if (payment.data?.payment_intent) { paymentId1 = String(payment.data.payment_intent); break }
          }
        }
      }

      // Upsell check
      const upsellPaymentId = meta.upsell_payment_id
      const isUpsell = !!meta.upsell_accepted && !!upsellPaymentId

      // Determine amounts for upsell
      let mainAmountCents = totalCents
      let upsellAmountCents = 0

      if (isUpsell && meta.upsell_amount) {
        upsellAmountCents = Number(meta.upsell_amount)
        mainAmountCents = totalCents - upsellAmountCents
      }

      // === ROW 1: Main payment ===
      const oldBalance1 = runningBalance
      const amountForRow1 = isUpsell && upsellAmountCents > 0 ? mainAmountCents : totalCents
      runningBalance += amountForRow1 / 100

      const note1 = `${orderNumber} / ${paymentMethod}`

      csvRows.push([
        accountNumber,                   // Cislo uctu
        stripDiacritics(accountName),    // Nazev uctu
        "",                              // Cislo protiuctu
        paymentId1,                      // Id transakce
        formatAmount(amountForRow1),     // Zauctovana castka
        invoiceNumber,                   // Variabilni symbol
        "",                              // Kod banky protistrany
        "0558",                          // Konstantni symbol
        "",                              // Specificky symbol
        dateStr,                         // Datum zauctovani
        customerName,                    // Nazev protistrany
        currency,                        // Mena
        periodStart,                     // Datum stareho zustatku
        oldBalance1.toFixed(2).replace(".", ","),  // Stary zustatek
        runningBalance.toFixed(2).replace(".", ","), // Novy zustatek
        stripDiacritics(note1),          // Poznamka
        "",                              // Obraty DEBET
        formatAmount(amountForRow1),     // Obraty KREDIT
        "",                              // Iban protistrany
      ].join(";"))

      // === ROW 2: Upsell payment (if applicable, non-COD) ===
      if (isUpsell && upsellPaymentId !== "cod" && upsellAmountCents > 0) {
        const oldBalance2 = runningBalance
        runningBalance += upsellAmountCents / 100

        const note2 = `${orderNumber} / ${paymentMethod} (upsell)`
        const upsellPid = upsellPaymentId !== "extraction_failed" ? upsellPaymentId : ""

        csvRows.push([
          accountNumber,
          stripDiacritics(accountName),
          "",
          upsellPid,
          formatAmount(upsellAmountCents),
          invoiceNumber,                 // Same VS as main payment
          "",
          "0558",
          "",
          dateStr,
          customerName,
          currency,
          periodStart,
          oldBalance2.toFixed(2).replace(".", ","),
          runningBalance.toFixed(2).replace(".", ","),
          stripDiacritics(note2),
          "",
          formatAmount(upsellAmountCents),
          "",
        ].join(";"))
      }
    }

    const csvContent = csvRows.join("\r\n") + "\r\n"

    // Generate filename
    const fromDate = from || new Date().toISOString().split("T")[0]
    const toDate = to || new Date().toISOString().split("T")[0]
    const filename = `payment-matching_${fromDate}_${toDate}.csv`

    res.setHeader("Content-Type", "text/csv; charset=utf-8")
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`)

    // Add BOM for Excel UTF-8 detection
    const bom = "\uFEFF"
    res.send(bom + csvContent)
  } catch (error: any) {
    console.error("[PaymentMatching:Export] Error:", error)
    res.status(500).json({ error: error.message })
  }
}
