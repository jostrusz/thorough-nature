// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import * as QRCode from "qrcode"
import { paymentReference, qrPayload, loadBankConfig } from "../../../modules/payment-bank-transfer/qr"

/**
 * GET /public/bank-transfer-qr?cart_id=xxx  (or ?order_id=xxx)
 *
 * Branded EPC/SEPA (or CZK QR Platba) payment QR as PNG, for the bank-transfer
 * e-mail <img>. Public: encodes only payment instructions the customer already
 * has. 404 when there is no QR for the entity/currency.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const cartId = req.query.cart_id as string
    const orderId = req.query.order_id as string
    if (!cartId && !orderId) { res.status(400).send("missing cart_id/order_id"); return }

    const query = req.scope.resolve("query")
    let currency = "EUR", amount = 0, refSeed = "", projectSlug

    if (cartId) {
      const { data } = await query.graph({ entity: "cart", fields: ["id", "currency_code", "metadata"], filters: { id: cartId } })
      const cart = data && data[0]
      if (!cart) { res.status(404).send("cart not found"); return }
      const { Pool } = require("pg")
      const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
      try {
        const { rows } = await pool.query(
          `SELECT COALESCE((SELECT SUM(quantity * unit_price) FROM cart_line_item WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS items,
                  COALESCE((SELECT SUM(amount) FROM cart_shipping_method WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS shipping`,
          [cartId]
        )
        amount = Number(rows[0]?.items || 0) + Number(rows[0]?.shipping || 0)
      } finally { await pool.end().catch(() => {}) }
      currency = String(cart.currency_code || "EUR").toUpperCase()
      refSeed = String(cart.metadata?.bank_transfer_reference || "")
      projectSlug = cart.metadata?.project_id || cart.metadata?.project_slug
    } else {
      const { data } = await query.graph({ entity: "order", fields: ["id", "display_id", "currency_code", "total", "metadata"], filters: { id: orderId } })
      const order = data && data[0]
      if (!order) { res.status(404).send("order not found"); return }
      currency = String(order.currency_code || "EUR").toUpperCase()
      amount = Number(order.total) || 0
      refSeed = String(order.metadata?.bank_transfer_reference || order.display_id || "")
      projectSlug = order.metadata?.project_id || order.metadata?.project_slug
    }

    const bank = await loadBankConfig(projectSlug)
    if (!bank || !bank.iban || !refSeed) { res.status(404).send("no config/reference"); return }

    const ref = paymentReference(refSeed, currency)
    const payload = qrPayload(amount, ref, currency, bank)
    if (!payload) { res.status(404).send("no QR for currency"); return }

    const png = await QRCode.toBuffer(payload, {
      type: "png", errorCorrectionLevel: "M", margin: 1, width: 600,
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
