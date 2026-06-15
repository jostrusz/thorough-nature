// @ts-nocheck

/**
 * Force-authorize a cart's Brite payment session(s) and point them at the
 * actually-settled session/transaction, so Medusa's completeCartWorkflow can
 * complete the cart.
 *
 * WHY THIS EXISTS:
 * For open-banking (Pay by Bank / iDEAL via Brite) the customer can close the
 * bank UI before returning — the Brite SESSION ends ABORTED (10) — yet the bank
 * still settles the transfer hours later, marking the TRANSACTION 4/5/6 (= money
 * received). In that state:
 *   1) the cart's payment_session sits in `canceled`, so validateCartPaymentsStep
 *      finds no processable session → completion throws, and
 *   2) on retry the cart may carry a LATER (also-aborted) session id, not the one
 *      that actually settled.
 * The money is at Brite, but no order is ever created.
 *
 * This rewrites briteSessionId / briteTransactionId on EVERY Brite session of the
 * cart's payment collection to the settled ids and sets status = 'authorized', so
 * completeCartWorkflow links the order to the correct (settled) transaction. The
 * service's authorizePayment then confirms via the late-settlement fallback
 * (session aborted but transaction 4/5/6 → CAPTURED), so re-authorization during
 * completion does NOT flip the session back to canceled.
 *
 * Shared by webhooks/brite (automatic safety-net), the brite-settled-reconcile
 * cron, and admin/safety-net-replay (manual recovery) so all paths behave
 * identically.
 *
 * Safe by construction: callers only invoke this for a transaction already
 * confirmed SETTLED/CREDIT/COMPLETED at Brite, with cart-total == paid-amount
 * validated beforehand.
 *
 * @param pool           an open pg Pool (caller owns its lifecycle)
 * @param cartId         the uncompleted cart to recover
 * @param sessionId      the Brite SESSION id that settled (briteSessionId)
 * @param transactionId  the Brite TRANSACTION id known to be SETTLED (optional but recommended)
 * @returns number of payment_session rows updated
 */
export async function forceAuthorizeBriteCartSession(
  pool: any,
  cartId: string,
  sessionId: string,
  transactionId?: string | null
): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE payment_session ps
     SET data = jsonb_set(
                  jsonb_set(ps.data, '{briteSessionId}', to_jsonb($2::text)),
                  '{briteTransactionId}', to_jsonb($3::text)
                ),
         status = 'authorized',
         updated_at = NOW()
     WHERE ps.payment_collection_id IN (
       SELECT payment_collection_id FROM cart_payment_collection WHERE cart_id = $1
     )
       AND ps.provider_id LIKE 'pp_brite%'`,
    [cartId, sessionId, transactionId || null]
  )
  return rowCount || 0
}
