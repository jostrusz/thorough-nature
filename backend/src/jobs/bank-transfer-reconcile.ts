// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { reconcileAllAwaitingCarts } from "../modules/payment-bank-transfer/reconcile"

/**
 * Bank Transfer (SEPA QR) reconciliation cron — Revolut Business backstop.
 *
 * Cart-first: every 15 min, match awaiting bank-transfer CARTS against recent
 * Revolut credits → completeCart → order created (paid) → fulfillment. The
 * status endpoint runs the same check on-demand (5 s polling) so the popup flips
 * within seconds. Dormant without REVOLUT_BUSINESS_* env creds.
 */
export default async function bankTransferReconcileJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  await reconcileAllAwaitingCarts(container, logger)
}

export const config = {
  name: "bank-transfer-reconcile",
  schedule: "*/15 * * * *",
}
