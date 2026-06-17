// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { recoverBriteCart } from "../modules/payment-brite/utils/recover"

/**
 * Brite Settled Reconciliation — late-settlement safety net.
 *
 * Runs hourly. Open-banking transfers can settle HOURS — or over a weekend, DAYS —
 * after the customer closed the bank UI (session ABORTED but transaction SETTLED).
 * When the webhook safety-net missed it (credentials hiccup, callback never fired,
 * settlement arrived after the abort), the money is at Brite but no order exists.
 *
 * This job:
 *   1) pulls Brite transactions in state 4/5/6 (completed/credit/settled) from the
 *      last 4 days (covers Friday-authorize → Monday-settle weekends),
 *   2) for each, attempts recoverBriteCart (idempotent — skips if an order already
 *      covers it),
 *   3) alerts (ntfy) on transactions it cannot recover (no cart / amount mismatch),
 *      which need manual handling via /admin/brite-recover.
 *
 * Vrstva 3 of the open-banking lost-order defence (see deeplink removal + WebView
 * gate for vrstva 1, authorizePayment late-settlement fallback for vrstva 2).
 */

const NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"
const LOOKBACK_MS = 4 * 24 * 60 * 60 * 1000 // 4 days — covers Fri-authorize → Mon-settle weekends

async function alert(title: string, body: string) {
  try {
    await fetch(NTFY_URL, {
      method: "POST",
      body,
      headers: { Title: title, Priority: "high", Tags: "warning,brite,reconcile" },
    })
  } catch { /* best effort */ }
}

async function getBriteCreds(): Promise<{ apiKey: string; secret: string; baseUrl: string } | null> {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys
       FROM gateway_config
       WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    if (!rows[0]) return null
    const keys = rows[0].mode === "live" ? rows[0].live_keys : rows[0].test_keys
    const apiKey = keys?.api_key
    const secret = keys?.secret_key
    if (!apiKey || !secret) return null
    const baseUrl =
      rows[0].mode === "live"
        ? "https://production.britepaymentgroup.com"
        : "https://sandbox.britepaymentgroup.com"
    return { apiKey, secret, baseUrl }
  } catch {
    return null
  } finally {
    await pool.end().catch(() => {})
  }
}

export default async function briteSettledReconcile(container: MedusaContainer) {
  const logger = container.resolve("logger")

  const creds = await getBriteCreds()
  if (!creds) {
    // Brite not active / not configured → nothing to reconcile.
    return
  }

  // 1) Authorize
  let token = ""
  try {
    const r = await fetch(`${creds.baseUrl}/api/merchant.authorize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ public_key: creds.apiKey, secret: creds.secret }),
    })
    const d = await r.json()
    token = d?.access_token || d?.token || ""
  } catch (e: any) {
    logger.warn(`[Brite Reconcile] authorize failed: ${e?.message}`)
    return
  }
  if (!token) return

  // 2) List recent transactions
  let txs: any[] = []
  try {
    const r = await fetch(`${creds.baseUrl}/api/transaction.list`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ limit: 200 }),
    })
    const d = await r.json()
    txs = d?.transactions || (Array.isArray(d) ? d : [])
  } catch (e: any) {
    logger.warn(`[Brite Reconcile] transaction.list failed: ${e?.message}`)
    return
  }

  // 3) Keep settled customer transactions (state 4/5/6, has merchant_reference) from the window.
  const cutoffSec = (Date.now() - LOOKBACK_MS) / 1000
  const settled = txs.filter(
    (t) =>
      [4, 5, 6].includes(Number(t?.state)) &&
      t?.merchant_reference &&
      Number(t?.created || 0) >= cutoffSec
  )

  if (!settled.length) {
    logger.info(`[Brite Reconcile] No settled transactions in the last 4 days.`)
    return
  }

  let created = 0
  let skipped = 0
  const failures: string[] = []

  for (const t of settled) {
    const sessionId = t?.session_id
    if (!sessionId) {
      // No session id on the transaction → can't map to a cart automatically.
      failures.push(`${t?.merchant_reference} (no session_id)`)
      continue
    }
    const res = await recoverBriteCart(container, {
      briteSessionId: String(sessionId),
      briteTransactionId: t?.id ? String(t.id) : null,
      paidAmount: Number(t?.amount || 0),
      currency: t?.currency,
      logger,
    })
    if (res.status === "created") created++
    else if (res.status === "already_exists") skipped++
    else failures.push(`${t?.merchant_reference} → ${res.status}${res.reason ? " (" + res.reason + ")" : ""}`)
  }

  logger.info(
    `[Brite Reconcile] Done: ${created} recovered, ${skipped} already had orders, ${failures.length} need manual handling (of ${settled.length} settled).`
  )

  if (failures.length) {
    await alert(
      "Brite reconcile: manual handling needed",
      `${failures.length} settled Brite transaction(s) could not be auto-recovered:\n` +
        failures.slice(0, 15).join("\n") +
        `\n\nUse POST /admin/brite-recover (with cart_id if the cart carries a later aborted session).`
    )
  }
}

export const config = {
  name: "brite-settled-reconcile",
  schedule: "0 * * * *", // hourly
}
