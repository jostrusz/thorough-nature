// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /store/bank-transfer-status?order_id=xxx
 *
 * Lightweight polling endpoint for the bank-transfer "waiting for payment" popup.
 * Returns whether the order's transfer has been reconciled (captured) yet — the
 * flag is set by the Revolut Business reconcile cron on `order.metadata`.
 * Public (publishable key), read-only, no sensitive data.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  try {
    const orderId = req.query.order_id as string
    if (!orderId) {
      res.json({ paid: false, awaiting: false })
      return
    }

    const query = req.scope.resolve("query")
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })

    const order = data && data[0]
    const m = (order && order.metadata) || {}
    const paid =
      m.payment_captured === true ||
      m.payment_captured === "true" ||
      m.bank_transfer_reconciled === true ||
      m.bank_transfer_reconciled === "true"

    res.json({
      paid: !!paid,
      awaiting: m.awaiting_bank_payment === true || m.awaiting_bank_payment === "true",
    })
  } catch (error: any) {
    // Never break the poller — treat errors as "not yet paid".
    res.status(200).json({ paid: false, awaiting: true, error: error.message })
  }
}
