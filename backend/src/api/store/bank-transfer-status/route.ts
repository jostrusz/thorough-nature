// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reconcileSingleOrder } from "../../../modules/payment-bank-transfer/reconcile"

/**
 * GET /store/bank-transfer-status?order_id=xxx
 *
 * Polling endpoint for the bank-transfer "waiting for payment" popup.
 * 1) If the order is already reconciled → paid:true.
 * 2) Otherwise runs an ON-DEMAND Revolut check for this order (shared 15 s
 *    transactions cache protects the rate limit) so the popup flips to "paid"
 *    within seconds of the transfer arriving — not only on the 15-min cron.
 * Public (publishable key), read-only-ish (only ever captures a matching payment).
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
      fields: ["id", "display_id", "currency_code", "metadata"],
      filters: { id: orderId },
    })
    const order = data && data[0]
    if (!order) {
      res.json({ paid: false, awaiting: false })
      return
    }

    const m = order.metadata || {}
    const alreadyPaid =
      m.payment_captured === true ||
      m.payment_captured === "true" ||
      m.bank_transfer_reconciled === true ||
      m.bank_transfer_reconciled === "true"
    if (alreadyPaid) {
      res.json({ paid: true, awaiting: false })
      return
    }

    // On-demand: only for orders actually awaiting a bank transfer.
    const awaiting = m.awaiting_bank_payment === true || m.awaiting_bank_payment === "true"
    if (awaiting) {
      try {
        const logger = req.scope.resolve("logger")
        const paid = await reconcileSingleOrder(
          { order_id: order.id, display_id: order.display_id, currency_code: order.currency_code },
          req.scope,
          logger
        )
        res.json({ paid: !!paid, awaiting: !paid })
        return
      } catch {
        /* fall through */
      }
    }

    res.json({ paid: false, awaiting })
  } catch (error: any) {
    res.status(200).json({ paid: false, awaiting: true, error: error.message })
  }
}
