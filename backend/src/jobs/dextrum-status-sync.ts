import { MedusaContainer } from "@medusajs/framework/types"
import { DEXTRUM_MODULE } from "../modules/dextrum"

/**
 * Dextrum Status Sync Job
 *
 * NOTE: mySTOCK does not support GET /orderIncoming/{id} (returns 405 Method Not Allowed).
 * Status updates come via webhooks (POST /webhooks/mystock) — see api/webhooks/mystock/route.ts.
 * The webhook handles: event 7 (processing), event 12 (dispatch), event 29 (carrier status), etc.
 *
 * This job is kept as a no-op placeholder. It runs every 5 minutes but does nothing.
 */
export default async function dextrumStatusSync(container: MedusaContainer) {
  // All status updates are handled by webhooks — no polling needed.
  return
}

export const config = {
  name: "dextrum-status-sync",
  schedule: "*/5 * * * *",
}
