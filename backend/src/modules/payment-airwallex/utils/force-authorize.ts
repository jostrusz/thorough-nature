// @ts-nocheck

/**
 * Force-authorize a cart's Airwallex payment session(s) and remap them to the
 * actually-paid payment intent, so Medusa's completeCartWorkflow can complete
 * the cart.
 *
 * WHY THIS EXISTS:
 * completeCartWorkflow → validateCartPaymentsStep requires at least one payment
 * session in status pending / requires_more / authorized. For redirect methods
 * (Przelewy24, BLIK, iDEAL, Bancontact, EPS) the Medusa session is only moved to
 * `authorized` by the frontend authorize step AFTER the shopper returns from the
 * bank. When the shopper never returns — or fires a retry that overwrites the
 * session with an unpaid SECOND intent — no processable session exists and
 * completion throws "Payment sessions are required to complete cart". The money
 * is captured at Airwallex, but no order is ever created.
 *
 * This sets status = 'authorized' and rewrites intentId / airwallexPaymentIntentId
 * to the paid intent on EVERY session of the cart's payment collection, so the
 * order links to the correct (paid) intent regardless of retry churn.
 *
 * Shared by webhooks/airwallex (automatic safety-net) and
 * admin/safety-net-replay (manual recovery) so both paths behave identically.
 *
 * Safe by construction: callers only invoke this for an intent already confirmed
 * SUCCEEDED at Airwallex, with cart-total == paid-amount validated beforehand.
 *
 * @param pool          an open pg Pool (caller owns its lifecycle)
 * @param cartId        the uncompleted cart to recover
 * @param paidIntentId  the Airwallex intent ID known to be SUCCEEDED/captured
 * @returns number of payment_session rows updated
 */
export async function forceAuthorizeCartSessions(
  pool: any,
  cartId: string,
  paidIntentId: string
): Promise<number> {
  const { rowCount } = await pool.query(
    `UPDATE payment_session ps
     SET data = jsonb_set(
                  jsonb_set(ps.data, '{intentId}', to_jsonb($2::text)),
                  '{airwallexPaymentIntentId}', to_jsonb($2::text)
                ),
         status = 'authorized',
         updated_at = NOW()
     WHERE ps.payment_collection_id IN (
       SELECT payment_collection_id FROM cart_payment_collection WHERE cart_id = $1
     )`,
    [cartId, paidIntentId]
  )
  return rowCount || 0
}
