/**
 * Brite ids are base64-encoded datastore keys whose decoded bytes contain the
 * entity name ("…Transaction…" / "…Session…"). Detect the kind so callers hit
 * the RIGHT endpoint (session.get vs transaction.get) and never trigger a 400
 * (session.get with a Transaction id — flagged by Brite in the integration
 * review, 2026-07-21). Twin of the webhook-local helper in webhooks/brite.
 */
export function briteIdKind(id: string): "transaction" | "session" | null {
  try {
    const decoded = Buffer.from(String(id), "base64").toString("latin1")
    if (decoded.includes("Transaction")) return "transaction"
    if (decoded.includes("Session")) return "session"
  } catch {
    /* not base64 — unknown */
  }
  return null
}
