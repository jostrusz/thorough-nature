// @ts-nocheck
import { Modules } from "@medusajs/framework/utils"
import * as crypto from "crypto"

/**
 * Shared Revolut Business reconciliation logic — used by both the 15-min cron
 * (backstop) and the /store/bank-transfer-status endpoint (on-demand, so the
 * "waiting for payment" popup flips to "paid" within seconds of the transfer).
 *
 * Caches the access token (~35 min) and the transactions list (~15 s) at module
 * scope so heavy polling (every 5 s per customer) hits Revolut at most ~once /15 s.
 */

const NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"
const AMOUNT_TOLERANCE = 0.02
const CREDITS_TTL_MS = 15_000

let _tokenCache: { token: string; exp: number } | null = null
let _creditsCache: { data: any[]; at: number } | null = null

async function alert(title: string, message: string): Promise<void> {
  try {
    await fetch(NTFY_URL, {
      method: "POST",
      headers: {
        Title: Buffer.from(title, "utf-8").toString("base64"),
        "X-Title-Encoding": "base64",
        Priority: "high",
        Tags: "warning,bank_transfer,reconcile",
      },
      body: message,
    })
  } catch {
    /* ignore */
  }
}

export function rfReference(orderNo: string): string {
  const ref = String(orderNo).replace(/[^0-9A-Za-z]/g, "")
  const rearr = (ref + "RF00").toUpperCase()
  let num = ""
  for (let i = 0; i < rearr.length; i++) {
    const c = rearr.charCodeAt(i)
    num += c >= 48 && c <= 57 ? rearr[i] : String(c - 55)
  }
  let rem = 0
  for (let j = 0; j < num.length; j++) rem = (rem * 10 + Number(num[j])) % 97
  let check = String(98 - rem)
  if (check.length < 2) check = "0" + check
  return "RF" + check + ref
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
}

function revolutBase(): string {
  return (process.env.REVOLUT_BUSINESS_ENV || "prod").toLowerCase() === "sandbox"
    ? "https://sandbox-b2b.revolut.com/api/1.0"
    : "https://b2b.revolut.com/api/1.0"
}

async function getAccessToken(logger: any): Promise<string | null> {
  if (_tokenCache && _tokenCache.exp > Date.now() + 30_000) return _tokenCache.token

  const clientId = process.env.REVOLUT_BUSINESS_CLIENT_ID
  const refreshToken = process.env.REVOLUT_BUSINESS_REFRESH_TOKEN
  const issuer = process.env.REVOLUT_BUSINESS_ISSUER
  let privateKey = process.env.REVOLUT_BUSINESS_PRIVATE_KEY
  if (!clientId || !refreshToken || !issuer || !privateKey) return null
  if (privateKey.indexOf("BEGIN") === -1) {
    try { privateKey = Buffer.from(privateKey, "base64").toString("utf-8") } catch { /* keep */ }
  }
  if (privateKey.indexOf("\\n") !== -1) privateKey = privateKey.replace(/\\n/g, "\n")

  try {
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const now = Math.floor(Date.now() / 1000)
    const payload = b64url(JSON.stringify({ iss: issuer, sub: clientId, aud: "https://revolut.com", exp: now + 300 }))
    const signer = crypto.createSign("RSA-SHA256")
    signer.update(header + "." + payload)
    signer.end()
    const jwt = header + "." + payload + "." + b64url(signer.sign(privateKey))

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
      client_assertion: jwt,
    })
    const res = await fetch(`${revolutBase()}/auth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    })
    if (!res.ok) {
      logger.warn(`[Bank Transfer Reconcile] Revolut auth HTTP ${res.status}: ${await res.text().catch(() => "")}`)
      return null
    }
    const data: any = await res.json()
    const token = data?.access_token || null
    if (token) _tokenCache = { token, exp: Date.now() + 35 * 60 * 1000 }
    return token
  } catch (e: any) {
    logger.warn(`[Bank Transfer Reconcile] Revolut auth failed: ${e.message}`)
    return null
  }
}

/** Incoming completed credits, cached ~15 s to protect the Revolut rate limit. */
export async function getRevolutCredits(logger: any): Promise<any[]> {
  if (_creditsCache && Date.now() - _creditsCache.at < CREDITS_TTL_MS) return _creditsCache.data

  const token = await getAccessToken(logger)
  if (!token) return []

  const from = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  let res: any
  try {
    res = await fetch(`${revolutBase()}/transactions?from=${from}&count=1000`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  } catch (e: any) {
    logger.warn(`[Bank Transfer Reconcile] Revolut transactions fetch failed: ${e.message}`)
    return _creditsCache?.data || []
  }
  if (!res.ok) {
    logger.warn(`[Bank Transfer Reconcile] Revolut transactions HTTP ${res.status}`)
    return _creditsCache?.data || []
  }

  let txns: any[]
  try { txns = await res.json() } catch { return _creditsCache?.data || [] }
  if (!Array.isArray(txns)) return _creditsCache?.data || []

  const out: any[] = []
  for (const t of txns) {
    if (t?.state !== "completed") continue
    for (const leg of (Array.isArray(t?.legs) ? t.legs : [])) {
      const amount = Number(leg?.amount)
      if (!isFinite(amount) || amount <= 0) continue
      const text = [t?.reference, leg?.description, t?.description].filter(Boolean).join(" ").toUpperCase()
      out.push({ id: String(t?.id || leg?.leg_id || ""), amount, currency: String(leg?.currency || "").toUpperCase(), text })
    }
  }
  _creditsCache = { data: out, at: Date.now() }
  return out
}

async function captureAndEmit(orderId: string, pool: any, container: any, logger: any): Promise<void> {
  try {
    const paymentModule = container.resolve(Modules.PAYMENT) as any
    const { rows: pcRows } = await pool.query(
      `SELECT pc.id FROM payment_collection pc
       JOIN order_payment_collection opc ON opc.payment_collection_id = pc.id
       WHERE opc.order_id = $1 AND pc.status = 'authorized' LIMIT 1`,
      [orderId]
    )
    if (pcRows.length > 0) {
      const { rows: payRows } = await pool.query(
        `SELECT id FROM payment WHERE payment_collection_id = $1 LIMIT 1`,
        [pcRows[0].id]
      )
      if (payRows.length > 0) {
        await paymentModule.capturePayment({ payment_id: payRows[0].id })
        logger.info(`[Bank Transfer Reconcile] Payment ${payRows[0].id} captured for order ${orderId}`)
      }
    }
  } catch (e: any) {
    logger.warn(`[Bank Transfer Reconcile] capture failed for order ${orderId}: ${e.message}`)
  }
  try {
    const eventBus = container.resolve(Modules.EVENT_BUS)
    await eventBus.emit({ name: "payment.captured", data: { id: orderId } })
  } catch (e: any) {
    logger.warn(`[Bank Transfer Reconcile] emit payment.captured failed: ${e.message}`)
  }
}

async function orderTotal(pool: any, orderId: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(quantity * unit_price) FROM order_line_item
                   WHERE order_id = $1 AND deleted_at IS NULL), 0)::numeric AS items_total,
         COALESCE((SELECT SUM(amount) FROM order_shipping_method
                   WHERE order_id = $1 AND deleted_at IS NULL), 0)::numeric AS shipping_total`,
      [orderId]
    )
    if (!rows[0]) return 0
    return Number(rows[0].items_total || 0) + Number(rows[0].shipping_total || 0)
  } catch {
    return 0
  }
}

/**
 * Match one awaiting order against the current credits and capture if found.
 * Returns true when the order is (now) paid. `usedTxnIds` prevents one credit
 * from being applied to two orders within a single cron sweep.
 */
export async function reconcileOrder(
  ord: any,
  credits: any[],
  usedTxnIds: Set<string>,
  pool: any,
  container: any,
  logger: any
): Promise<boolean> {
  const orderNo = String(ord.display_id || "")
  if (!orderNo) return false
  const rf = rfReference(orderNo).toUpperCase()
  const digits = orderNo.replace(/[^0-9]/g, "")
  const orderCcy = String(ord.currency_code || "").toUpperCase()

  const match = credits.find((c) => {
    if (usedTxnIds.has(c.id)) return false
    if (orderCcy && c.currency && c.currency !== orderCcy) return false
    const t = c.text
    return t.indexOf(rf) !== -1 || (digits.length >= 3 && t.indexOf(digits) !== -1)
  })
  if (!match) return false

  const total = await orderTotal(pool, ord.order_id)
  if (total > 0 && match.amount < total - AMOUNT_TOLERANCE) {
    logger.error(`[Bank Transfer Reconcile] underpayment order ${orderNo}: paid=${match.amount} total=${total} — skip`)
    await alert("Bank transfer: underpayment", `Order ${orderNo} paid ${match.amount} ${match.currency} but total ${total}. Revolut txn ${match.id}. Manual review.`)
    return false
  }

  usedTxnIds.add(match.id)
  const stamp = {
    awaiting_bank_payment: false,
    bank_transfer_reconciled: true,
    payment_captured: true,
    payment_captured_at: new Date().toISOString(),
    payment_method: "bank_transfer_sepa",
    payment_provider: "bank_transfer",
    bank_transfer_reference: rf,
    revolut_transaction_id: String(match.id),
    completed_by: "bank_transfer_reconcile",
  }
  await pool.query(
    `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(stamp), ord.order_id]
  )
  await captureAndEmit(ord.order_id, pool, container, logger)
  logger.info(`[Bank Transfer Reconcile] ✅ Matched order ${orderNo} → Revolut txn ${match.id} (${match.amount} ${match.currency})`)
  await alert("Bank transfer: payment reconciled", `Order ${orderNo} paid ${match.amount} ${match.currency} (Revolut txn ${match.id}). Fulfillment released.`)
  return true
}

/** On-demand: check a single order right now (used by the status endpoint). */
export async function reconcileSingleOrder(order: any, container: any, logger: any): Promise<boolean> {
  const credits = await getRevolutCredits(logger)
  if (!credits.length) return false
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    return await reconcileOrder(order, credits, new Set<string>(), pool, container, logger)
  } finally {
    await pool.end().catch(() => {})
  }
}

/** Cron backstop: reconcile every still-awaiting order. */
export async function reconcileAllAwaiting(container: any, logger: any): Promise<void> {
  const credits = await getRevolutCredits(logger)
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  const usedTxnIds = new Set<string>()
  try {
    const { rows: orders } = await pool.query(
      `SELECT o.id AS order_id, o.display_id, o.email, o.currency_code
       FROM "order" o
       WHERE o.metadata->>'awaiting_bank_payment' = 'true'
         AND COALESCE(o.metadata->>'payment_captured', '') <> 'true'
         AND o.created_at > now() - interval '21 days'
       ORDER BY o.created_at DESC
       LIMIT 200`
    )
    logger.info(`[Bank Transfer Reconcile] tick: ${credits.length} incoming credits, ${orders.length} awaiting orders`)
    for (const ord of orders) {
      try { await reconcileOrder(ord, credits, usedTxnIds, pool, container, logger) }
      catch (e: any) { logger.error(`[Bank Transfer Reconcile] order ${ord.display_id} failed: ${e.message}`) }
    }
  } catch (err: any) {
    logger.error(`[Bank Transfer Reconcile] job failed: ${err.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}
