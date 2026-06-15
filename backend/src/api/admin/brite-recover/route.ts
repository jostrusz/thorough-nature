// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { recoverBriteCart } from "../../../modules/payment-brite/utils/recover"

/**
 * POST /admin/brite-recover
 *
 * Manually recover a Brite-paid-but-orderless cart (open-banking late settlement:
 * the session aborted but the transaction settled, so the webhook safety-net /
 * completeCart refused). Mirrors the Airwallex /admin/safety-net-replay.
 *
 * Body:
 *   - brite_session_id: string (required) — the SETTLED Brite session id
 *   - brite_transaction_id: string (optional, recommended) — the SETTLED transaction id
 *   - paid_amount: number (required, major units) — validated against cart total
 *   - cart_id: string (optional) — pin the exact cart (needed when the cart carries
 *              a LATER aborted session id than the one that settled, e.g. retries)
 *   - payment_method: string (optional, default pay_by_bank)
 *
 * Returns: { status, order_id?, reason?, cart_total? }
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const body = (req.body || {}) as Record<string, any>

  const briteSessionId = String(body.brite_session_id || "")
  const briteTransactionId = body.brite_transaction_id ? String(body.brite_transaction_id) : null
  const paidAmount = Number(body.paid_amount || 0)
  const cartId = body.cart_id ? String(body.cart_id) : undefined
  const paymentMethod = body.payment_method ? String(body.payment_method) : "pay_by_bank"

  if (!briteSessionId || !paidAmount) {
    return res.status(400).json({ error: "brite_session_id and paid_amount are required" })
  }

  const result = await recoverBriteCart(req.scope, {
    cartId,
    briteSessionId,
    briteTransactionId,
    paidAmount,
    paymentMethod,
    logger,
  })

  const httpStatus =
    result.status === "created" ? 200 :
    result.status === "already_exists" ? 409 :
    result.status === "no_cart" ? 404 :
    result.status === "amount_mismatch" ? 422 : 500

  return res.status(httpStatus).json(result)
}
