// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getProjectEmailConfig } from "../../../utils/project-email-config"
import { loadBankConfig, paymentReference } from "../../../modules/payment-bank-transfer/qr"
import { sendBankTransferEmail } from "../../../modules/payment-bank-transfer/email"

const PROJECT_LOCALE: Record<string, string> = {
  "pusti-to-sk": "sk", "psi-superzivot": "cs", "lass-los": "de",
  loslatenboek: "nl", "het-leven": "nl", dehondenbijbel: "nl",
  "odpusc-ksiazka": "pl", "slapp-taget": "sv", "slipp-taket": "no", "engedd-el": "hu",
}

/**
 * POST /store/bank-transfer-init  { cart_id, project_slug }
 *
 * Cart-first bank transfer: the cart is NOT completed (no order in admin yet).
 * This assigns the cart a numeric payment reference, flags it awaiting, and
 * e-mails the customer the payment details + QR. The order is created only once
 * the Revolut reconcile matches the transfer. Returns { reference }.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const body = req.body || {}
    const cartId = body.cart_id as string
    const projectSlug = (body.project_slug as string) || undefined
    if (!cartId) { res.status(400).json({ error: "missing cart_id" }); return }

    const query = req.scope.resolve("query")
    const { data: cartData } = await query.graph({
      entity: "cart",
      fields: [
        "id", "email", "currency_code", "metadata",
        "shipping_address.first_name", "shipping_address.last_name", "shipping_address.address_1",
        "shipping_address.address_2", "shipping_address.city", "shipping_address.postal_code", "shipping_address.country_code",
      ],
      filters: { id: cartId },
    })
    const cart = cartData && cartData[0]
    if (!cart) { res.status(404).json({ error: "cart not found" }); return }

    const { Pool } = require("pg")
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
    try {
      // Reuse an existing reference if init was already called for this cart.
      let reference = cart.metadata && cart.metadata.bank_transfer_reference
      if (!reference) {
        reference = String(Date.now()).slice(-8) + Math.floor(Math.random() * 10)
        await pool.query(
          `UPDATE cart SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
          [JSON.stringify({ bank_transfer_reference: reference, awaiting_bank_payment: true, payment_method: "bank_transfer_sepa", project_id: projectSlug }), cartId]
        )
      }

      // Cart total (items + shipping) for the e-mail amount.
      const { rows: totRows } = await pool.query(
        `SELECT COALESCE((SELECT SUM(quantity * unit_price) FROM cart_line_item WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS items,
                COALESCE((SELECT SUM(amount) FROM cart_shipping_method WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS shipping`,
        [cartId]
      )
      const amount = Number(totRows[0]?.items || 0) + Number(totRows[0]?.shipping || 0)
      const currency = String(cart.currency_code || "EUR").toUpperCase()

      // Line items → transactional content in the e-mail (better inbox placement).
      const { rows: itemRows } = await pool.query(
        `SELECT title, quantity, unit_price FROM cart_line_item WHERE cart_id = $1 AND deleted_at IS NULL`,
        [cartId]
      )

      const bank = await loadBankConfig(projectSlug)
      if (bank && bank.iban && cart.email) {
        const cfg = getProjectEmailConfig({ metadata: { project_id: projectSlug } })
        const locale = cfg.locale || PROJECT_LOCALE[projectSlug] || "sk"
        const emailRef = paymentReference(String(reference), currency)

        // Delivery / pickup point (from checkout metadata + shipping address).
        const md = cart.metadata || {}
        const addr = cart.shipping_address || {}
        const recipient = [addr.first_name, addr.last_name].filter(Boolean).join(" ").trim()
        const isPickup = md.shipping_method === "zasilkovna_pickup" || !!md.packeta_point_id
        const delivery = isPickup
          ? { pickup: true, recipient, pointName: md.packeta_point_name || "", pointAddress: md.packeta_point_address || "" }
          : {
              pickup: false, recipient,
              street: [addr.address_1, addr.address_2].filter(Boolean).join(", "),
              cityLine: [addr.postal_code, addr.city].filter(Boolean).join(" "),
              country: (addr.country_code || "").toUpperCase(),
            }

        // Fire-and-forget: never block the checkout response on the e-mail.
        sendBankTransferEmail({
          to: cart.email, from: cfg.fromEmail || process.env.RESEND_FROM_EMAIL, replyTo: cfg.replyTo,
          locale, code: String(reference), iban: bank.iban, bic: bank.bic, beneficiary: bank.beneficiary,
          reference: emailRef, amount, currency, cartId,
          items: itemRows.map((r) => ({ title: r.title, quantity: Number(r.quantity), unit_price: Number(r.unit_price) })),
          delivery,
        }).then((r) => {
          if (!r.ok) console.error(`[Bank Transfer Init] email failed cart ${cartId}: ${JSON.stringify(r.error)}`)
          else console.log(`[Bank Transfer Init] email sent to ${cart.email} (ref ${reference})`)
        }).catch(() => {})
      }

      res.json({ reference: String(reference) })
    } finally {
      await pool.end().catch(() => {})
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message })
  }
}
