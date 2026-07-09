// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import * as QRCode from "qrcode"
import { paymentReference, qrPayload, loadBankConfig } from "../../../modules/payment-bank-transfer/qr"

/**
 * GET /public/bank-transfer-qr?order_id=xxx
 *
 * Returns the branded EPC/SEPA (or CZK "QR Platba") payment QR as a PNG, so the
 * bank-transfer instruction e-mail can embed it via <img src="…">. Public: the
 * QR only encodes the payment instructions the customer already has (IBAN,
 * amount, reference). 404 when the order/gateway/currency has no QR.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const orderId = req.query.order_id as string
    if (!orderId) { res.status(400).send("missing order_id"); return }

    const query = req.scope.resolve("query")
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "currency_code", "total", "metadata"],
      filters: { id: orderId },
    })
    const order = data && data[0]
    if (!order) { res.status(404).send("order not found"); return }

    const projectSlug = (order.metadata && (order.metadata.project_id || order.metadata.project_slug)) || undefined
    const bank = await loadBankConfig(projectSlug)
    if (!bank || !bank.iban) { res.status(404).send("no bank config"); return }

    const currency = String(order.currency_code || bank.currency || "EUR").toUpperCase()
    const amount = Number(order.total) || 0
    const ref = paymentReference(String(order.display_id || ""), currency)
    const payload = qrPayload(amount, ref, currency, bank)
    if (!payload) { res.status(404).send("no QR for currency"); return }

    const png = await QRCode.toBuffer(payload, {
      type: "png",
      errorCorrectionLevel: "M",
      margin: 1,
      width: 600,
      color: { dark: "#2D1B3DFF", light: "#FFFFFFFF" },
    })

    res.setHeader("Content-Type", "image/png")
    res.setHeader("Cache-Control", "public, max-age=86400")
    res.setHeader("Access-Control-Allow-Origin", "*")
    res.send(png)
  } catch (error: any) {
    res.status(500).send("qr error")
  }
}
