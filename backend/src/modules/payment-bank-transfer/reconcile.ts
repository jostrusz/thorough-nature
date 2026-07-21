// @ts-nocheck
import { Modules } from "@medusajs/framework/utils"
import * as crypto from "crypto"

/**
 * Cart-first Revolut Business reconciliation.
 *
 * Bank-transfer checkout does NOT complete the cart — no order appears in admin
 * until the money actually arrives. Each awaiting cart carries a numeric
 * bank_transfer_reference (metadata). This job (cron backstop + on-demand from
 * the status endpoint) matches Revolut incoming credits to those carts by
 * reference + amount, and on a match runs completeCartWorkflow → the order is
 * created ALREADY PAID → captured → fulfillment. Unmatched carts simply expire
 * after 5 days (never become an order — nothing to cancel).
 *
 * Token cached ~35 min, transactions ~15 s (protects the Revolut rate limit
 * under 5 s polling).
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
      headers: { Title: Buffer.from(title, "utf-8").toString("base64"), "X-Title-Encoding": "base64", Priority: "high", Tags: "warning,bank_transfer,reconcile" },
      body: message,
    })
  } catch { /* ignore */ }
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
  if (privateKey.indexOf("BEGIN") === -1) { try { privateKey = Buffer.from(privateKey, "base64").toString("utf-8") } catch {} }
  if (privateKey.indexOf("\\n") !== -1) privateKey = privateKey.replace(/\\n/g, "\n")
  try {
    const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    const now = Math.floor(Date.now() / 1000)
    const payload = b64url(JSON.stringify({ iss: issuer, sub: clientId, aud: "https://revolut.com", exp: now + 300 }))
    const signer = crypto.createSign("RSA-SHA256")
    signer.update(header + "." + payload); signer.end()
    const jwt = header + "." + payload + "." + b64url(signer.sign(privateKey))
    const body = new URLSearchParams({
      grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId,
      client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer", client_assertion: jwt,
    })
    const res = await fetch(`${revolutBase()}/auth/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: body.toString() })
    if (!res.ok) { logger.warn(`[Bank Transfer Reconcile] Revolut auth HTTP ${res.status}: ${await res.text().catch(() => "")}`); return null }
    const data: any = await res.json()
    const token = data?.access_token || null
    if (token) _tokenCache = { token, exp: Date.now() + 35 * 60 * 1000 }
    return token
  } catch (e: any) { logger.warn(`[Bank Transfer Reconcile] Revolut auth failed: ${e.message}`); return null }
}

export async function getRevolutCredits(logger: any): Promise<any[]> {
  if (_creditsCache && Date.now() - _creditsCache.at < CREDITS_TTL_MS) return _creditsCache.data
  const token = await getAccessToken(logger)
  if (!token) return []
  const from = new Date(Date.now() - 21 * 24 * 3600 * 1000).toISOString().slice(0, 10)
  let res: any
  try { res = await fetch(`${revolutBase()}/transactions?from=${from}&count=1000`, { headers: { Authorization: `Bearer ${token}` } }) }
  catch (e: any) { logger.warn(`[Bank Transfer Reconcile] transactions fetch failed: ${e.message}`); return _creditsCache?.data || [] }
  if (!res.ok) { logger.warn(`[Bank Transfer Reconcile] transactions HTTP ${res.status}`); return _creditsCache?.data || [] }
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
      out.push({
        id: String(t?.id || leg?.leg_id || ""),
        amount,
        currency: String(leg?.currency || "").toUpperCase(),
        text,
        // Payer name for the no-reference fallback. CZ/SK banks routinely strip
        // the remittance line, leaving only "Payment from <name>".
        payer: nameKey(String(leg?.description || t?.description || "").replace(/^payment from\s*/i, "")),
        at: Date.parse(t?.completed_at || t?.created_at || "") || 0,
      })
    }
  }
  _creditsCache = { data: out, at: Date.now() }
  return out
}

/**
 * Diacritics-insensitive, order-insensitive name key: "Kristína Vojtylová" and
 * the Revolut payer "Kristina Vojtylova" collapse to the same token set.
 */
export function nameKey(name: string): string {
  return String(name || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/).filter((w) => w.length > 1).sort().join(" ")
}

/** Do two name keys describe the same person? Requires ≥2 shared tokens
 *  (given + family name), so a lone common first name never matches. */
function sameName(a: string, b: string): boolean {
  if (!a || !b) return false
  if (a === b) return true
  const A = new Set(a.split(" ")), B = b.split(" ")
  return B.filter((w) => A.has(w)).length >= 2
}

async function cartTotal(pool: any, cartId: string): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT
         COALESCE((SELECT SUM(quantity * unit_price) FROM cart_line_item WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS items,
         COALESCE((SELECT SUM(amount) FROM cart_shipping_method WHERE cart_id = $1 AND deleted_at IS NULL), 0)::numeric AS shipping`,
      [cartId]
    )
    if (!rows[0]) return 0
    return Number(rows[0].items || 0) + Number(rows[0].shipping || 0)
  } catch { return 0 }
}

async function captureAndEmit(orderId: string, pool: any, container: any, logger: any): Promise<void> {
  try {
    const paymentModule = container.resolve(Modules.PAYMENT) as any
    const { rows: pcRows } = await pool.query(
      `SELECT pc.id FROM payment_collection pc
       JOIN order_payment_collection opc ON opc.payment_collection_id = pc.id
       WHERE opc.order_id = $1 AND pc.status = 'authorized' LIMIT 1`, [orderId]
    )
    if (pcRows.length > 0) {
      const { rows: payRows } = await pool.query(`SELECT id FROM payment WHERE payment_collection_id = $1 LIMIT 1`, [pcRows[0].id])
      if (payRows.length > 0) {
        await paymentModule.capturePayment({ payment_id: payRows[0].id })
        logger.info(`[Bank Transfer Reconcile] Payment ${payRows[0].id} captured for order ${orderId}`)
      }
    }
  } catch (e: any) { logger.warn(`[Bank Transfer Reconcile] capture failed for order ${orderId}: ${e.message}`) }
  try {
    const eventBus = container.resolve(Modules.EVENT_BUS)
    await eventBus.emit({ name: "payment.captured", data: { id: orderId } })
  } catch (e: any) { logger.warn(`[Bank Transfer Reconcile] emit payment.captured failed: ${e.message}`) }
}

/**
 * Match one awaiting CART against current credits; if paid → complete it (create
 * the order), capture, fulfill. Returns the new order id, or null.
 */
export async function reconcileCart(cart: any, credits: any[], usedTxnIds: Set<string>, pool: any, container: any, logger: any): Promise<string | null> {
  const rawRef = String(cart.reference || "")
  if (!rawRef) return null
  const rf = rfReference(rawRef).toUpperCase()
  const digits = rawRef.replace(/[^0-9]/g, "")
  const cartCcy = String(cart.currency_code || "").toUpperCase()

  const eligible = credits.filter((c) => {
    if (usedTxnIds.has(c.id)) return false
    if (cartCcy && c.currency && c.currency !== cartCcy) return false
    return true
  })

  // 1) reference in the remittance text — the reliable path
  let match = eligible.find((c) => {
    const t = c.text
    return t.indexOf(rf) !== -1 || (digits.length >= 3 && t.indexOf(digits) !== -1)
  })

  const total = await cartTotal(pool, cart.cart_id)

  // 2) fallback: no reference survived the bank (typical for CZ/SK transfers,
  //    where the credit arrives as a bare "Payment from <name>"). Match on
  //    payer name + exact amount + a credit that landed AFTER the cart was
  //    created. All three must line up, and the payer must share given AND
  //    family name with the shipping address, so a mismatch is very unlikely.
  let matchedBy = "reference"
  if (!match && total > 0) {
    const cartName = nameKey(cart.customer_name || "")
    const createdAt = Date.parse(cart.created_at || "") || 0
    if (cartName && createdAt) {
      const byName = eligible.filter((c) =>
        sameName(cartName, c.payer || "") &&
        Math.abs(c.amount - total) <= AMOUNT_TOLERANCE &&
        c.at >= createdAt - 60_000
      )
      // ambiguity guard: only act when exactly one credit fits
      if (byName.length === 1) {
        match = byName[0]
        matchedBy = "payer name + amount"
        logger.info(`[Bank Transfer Reconcile] cart ${cart.cart_id}: no reference in credit, matched by payer name "${match.payer}" + ${match.amount} ${match.currency}`)
      } else if (byName.length > 1) {
        logger.warn(`[Bank Transfer Reconcile] cart ${cart.cart_id}: ${byName.length} credits fit payer name + amount — skipping to avoid a wrong match`)
      }
    }
  }
  if (!match) return null
  if (total > 0 && match.amount < total - AMOUNT_TOLERANCE) {
    logger.error(`[Bank Transfer Reconcile] underpayment cart ${cart.cart_id}: paid=${match.amount} total=${total} — skip`)
    await alert("Bank transfer: underpayment", `Cart ${cart.cart_id} (ref ${rawRef}) paid ${match.amount} ${match.currency} but total ${total}. Revolut txn ${match.id}. Manual review.`)
    return null
  }

  usedTxnIds.add(match.id)

  // Complete the cart → the order is created now, already paid.
  let orderId: string | null = null
  try {
    const { completeCartWorkflow } = await import("@medusajs/medusa/core-flows")
    const result: any = await completeCartWorkflow(container).run({ input: { id: cart.cart_id } })
    orderId = result?.result?.id || result?.result?.order?.id || result?.id || result?.order?.id || null
  } catch (e: any) {
    logger.error(`[Bank Transfer Reconcile] completeCart failed for cart ${cart.cart_id}: ${e.message}`)
    usedTxnIds.delete(match.id) // allow retry next tick
    return null
  }
  if (!orderId) {
    logger.error(`[Bank Transfer Reconcile] completeCart returned no order for cart ${cart.cart_id}`)
    usedTxnIds.delete(match.id)
    return null
  }

  const stamp = {
    awaiting_bank_payment: false,
    bank_transfer_reconciled: true,
    payment_captured: true,
    payment_captured_at: new Date().toISOString(),
    payment_method: "bank_transfer_sepa",
    payment_provider: "bank_transfer",
    bank_transfer_reference: rf,
    bank_transfer_email_sent: true, // sent at init — never re-send from order.placed
    revolut_transaction_id: String(match.id),
    completed_by: "bank_transfer_reconcile",
  }
  await pool.query(
    `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
    [JSON.stringify(stamp), orderId]
  )
  await captureAndEmit(orderId, pool, container, logger)

  logger.info(`[Bank Transfer Reconcile] ✅ Cart ${cart.cart_id} (ref ${rawRef}, matched by ${matchedBy}) → order ${orderId} (${match.amount} ${match.currency})`)
  await alert("Bank transfer: order created (paid)", `Ref ${rawRef} paid ${match.amount} ${match.currency} → order ${orderId} created + captured. (Revolut txn ${match.id})`)
  return orderId
}

const AWAITING_CART_SQL = `
  SELECT c.id AS cart_id, c.email, c.currency_code, c.created_at,
         c.metadata->>'bank_transfer_reference' AS reference,
         COALESCE(
           NULLIF(TRIM(CONCAT_WS(' ', sa.first_name, sa.last_name)), ''),
           NULLIF(TRIM(CONCAT_WS(' ', ba.first_name, ba.last_name)), '')
         ) AS customer_name
  FROM cart c
  LEFT JOIN cart_address sa ON sa.id = c.shipping_address_id
  LEFT JOIN cart_address ba ON ba.id = c.billing_address_id
  JOIN cart_payment_collection cpc ON cpc.cart_id = c.id
  JOIN payment_collection pc ON pc.id = cpc.payment_collection_id
  JOIN payment_session ps ON ps.payment_collection_id = pc.id
  WHERE c.completed_at IS NULL
    AND ps.provider_id LIKE '%bank_transfer%'
    AND c.metadata->>'bank_transfer_reference' IS NOT NULL
    AND c.created_at > now() - interval '5 days'`

/** On-demand: check a single awaiting cart right now (status endpoint). Returns order id or null. */
export async function reconcileSingleCart(cartId: string, container: any, logger: any): Promise<string | null> {
  const credits = await getRevolutCredits(logger)
  if (!credits.length) return null
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    const { rows } = await pool.query(`${AWAITING_CART_SQL} AND c.id = $1 GROUP BY c.id, sa.id, ba.id LIMIT 1`, [cartId])
    if (!rows[0]) return null
    return await reconcileCart(rows[0], credits, new Set<string>(), pool, container, logger)
  } catch (e: any) {
    logger.warn(`[Bank Transfer Reconcile] single cart ${cartId} failed: ${e.message}`)
    return null
  } finally { await pool.end().catch(() => {}) }
}

/** Cron backstop: reconcile every still-awaiting cart (5-day window). */
export async function reconcileAllAwaitingCarts(container: any, logger: any): Promise<void> {
  const credits = await getRevolutCredits(logger)
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  const usedTxnIds = new Set<string>()
  try {
    const { rows: carts } = await pool.query(`${AWAITING_CART_SQL} GROUP BY c.id, sa.id, ba.id ORDER BY c.created_at DESC LIMIT 200`)
    logger.info(`[Bank Transfer Reconcile] tick: ${credits.length} incoming credits, ${carts.length} awaiting carts`)
    for (const cart of carts) {
      try { await reconcileCart(cart, credits, usedTxnIds, pool, container, logger) }
      catch (e: any) { logger.error(`[Bank Transfer Reconcile] cart ${cart.cart_id} failed: ${e.message}`) }
    }
  } catch (err: any) {
    logger.error(`[Bank Transfer Reconcile] job failed: ${err.message}`)
  } finally { await pool.end().catch(() => {}) }
}
