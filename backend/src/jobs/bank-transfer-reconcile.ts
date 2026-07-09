// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { reconcileAllAwaiting } from "../modules/payment-bank-transfer/reconcile"

/**
 * Bank Transfer (SEPA QR) reconciliation cron — Revolut Business backstop.
 *
 * Every 15 min, reconcile every still-awaiting order against recent Revolut
 * Business credits (match reference + amount → capture → payment.captured →
 * fulfillment). The heavy lifting + caching lives in the shared reconcile lib,
 * which the /store/bank-transfer-status endpoint also uses for on-demand checks
 * (so the "waiting for payment" popup flips within seconds). Dormant without
 * REVOLUT_BUSINESS_* env creds.
 */
export default async function bankTransferReconcileJob(container: MedusaContainer) {
  const logger = container.resolve("logger")
  await reconcileAllAwaiting(container, logger)
}

export const config = {
  name: "bank-transfer-reconcile",
  schedule: "*/15 * * * *",
}
