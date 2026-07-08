// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

/**
 * Bank Transfer (SEPA QR) reconciliation cron.
 *
 * The `bank_transfer` gateway creates the order UNPAID at checkout (provider
 * pp_bank_transfer_bank_transfer, metadata.awaiting_bank_payment = true) and
 * shows the customer a SEPA QR + IBAN with an RF creditor reference derived from
 * the order display_id. There is no provider webhook — the money simply lands on
 * our FIO EUR account minutes/hours/days later.
 *
 * Every 15 min this job polls FIO for recent incoming EUR credits and matches
 * each still-awaiting order by its RF reference / order number (+ soft amount
 * guard). On a match it captures the payment and emits payment.captured (→ ebook,
 * Dextrum release, invoice), mirroring the other gateway reconcilers.
 *
 * Idempotent: skips orders already captured and records the matched FIO
 * transaction id so the same credit is never applied twice.
 *
 * Requires env FIO_EUR_TOKEN (read-only FIO API token for the EUR account).
 * Absent token → no-op (feature simply stays dormant).
 */

const NTFY_URL = "https://ntfy.sh/medusa-ntfy-obj-2026"
const ORDER_LOOKBACK = "21 days" // deferred transfers can settle over many days
const MAX_CANDIDATES = 200
const AMOUNT_TOLERANCE = 0.02

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

// ISO 11649 RF Creditor Reference from an order number (same algo as the checkout).
function rfReference(orderNo: string): string {
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

/**
 * Fetch recent incoming EUR credits from FIO for a fixed lookback window.
 * Uses the periods endpoint (idempotent — does not move FIO's download marker).
 * Returns [{ id, amount, currency, text }] for credits only (amount > 0).
 */
async function fetchFioCredits(token: string, logger: any): Promise<any[]> {
  const to = new Date()
  const from = new Date(to.getTime() - 21 * 24 * 3600 * 1000)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const url = `https://fioapi.fio.cz/v1/rest/periods/${token}/${fmt(from)}/${fmt(to)}/transactions.json`

  let res: any
  try {
    res = await fetch(url)
  } catch (e: any) {
    logger.warn(`[Bank Transfer Reconcile] FIO fetch failed: ${e.message}`)
    return []
  }
  if (!res.ok) {
    logger.warn(`[Bank Transfer Reconcile] FIO HTTP ${res.status}`)
    return []
  }

  let data: any
  try {
    data = await res.json()
  } catch {
    return []
  }

  const txns = data?.accountStatement?.transactionList?.transaction || []
  const col = (t: any, n: number) => {
    const c = t?.[`column${n}`]
    return c && c.value != null ? String(c.value) : ""
  }

  const out: any[] = []
  for (const t of txns) {
    const amount = Number(col(t, 1))
    if (!isFinite(amount) || amount <= 0) continue // credits only
    const currency = (col(t, 14) || "EUR").toUpperCase()
    // Gather every free-text/reference field a sending bank might carry the RF in.
    const text = [
      col(t, 5), // VS
      col(t, 6), // SS
      col(t, 7), // user identification
      col(t, 10), // comment / upřesnění
      col(t, 16), // message for recipient
      col(t, 25), // comment
      col(t, 27), // instruction id
    ]
      .join(" ")
      .toUpperCase()
    out.push({
      id: col(t, 22) || col(t, 17) || `${col(t, 0)}_${amount}`,
      amount,
      currency,
      text,
    })
  }
  return out
}

/** Capture an order's authorized payment + emit payment.captured. */
async function captureAndEmit(
  orderId: string,
  pool: any,
  container: MedusaContainer,
  logger: any
): Promise<void> {
  try {
    const paymentModule = container.resolve(Modules.PAYMENT) as any
    const { rows: pcRows } = await pool.query(
      `SELECT pc.id FROM payment_collection pc
       JOIN order_payment_collection opc ON opc.payment_collection_id = pc.id
       WHERE opc.order_id = $1 AND pc.status = 'authorized'
       LIMIT 1`,
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

/** Best-effort gross order total (item + shipping) for the underpayment guard. */
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

export default async function bankTransferReconcileJob(container: MedusaContainer) {
  const logger = container.resolve("logger")

  const token = process.env.FIO_EUR_TOKEN || process.env.FIO_TOKEN_EUR
  if (!token) return // no FIO token → feature dormant

  const credits = await fetchFioCredits(token, logger)
  if (!credits.length) return

  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  const usedTxnIds = new Set<string>()

  try {
    const { rows: orders } = await pool.query(
      `SELECT o.id AS order_id, o.display_id, o.email
       FROM "order" o
       WHERE o.metadata->>'awaiting_bank_payment' = 'true'
         AND COALESCE(o.metadata->>'payment_captured', '') <> 'true'
         AND o.created_at > now() - interval '${ORDER_LOOKBACK}'
       ORDER BY o.created_at DESC
       LIMIT ${MAX_CANDIDATES}`
    )

    for (const ord of orders) {
      const orderNo = String(ord.display_id || "")
      if (!orderNo) continue
      const rf = rfReference(orderNo).toUpperCase()
      const digits = orderNo.replace(/[^0-9]/g, "")

      // Match a still-unused EUR credit whose reference text carries this order's
      // RF reference (preferred) or bare order number.
      const match = credits.find((c) => {
        if (usedTxnIds.has(c.id)) return false
        if (c.currency !== "EUR") return false
        const t = c.text
        return t.indexOf(rf) !== -1 || (digits.length >= 3 && t.indexOf(digits) !== -1)
      })
      if (!match) continue

      // Underpayment guard: if we can compute the order total, the paid amount must
      // not be materially below it. Tax-inclusive vs net ambiguity only ever makes
      // the computed total LOWER, so a strict "below" check is safe.
      const total = await orderTotal(pool, ord.order_id)
      if (total > 0 && match.amount < total - AMOUNT_TOLERANCE) {
        logger.error(
          `[Bank Transfer Reconcile] underpayment order ${orderNo}: paid=${match.amount} total=${total} — skip`
        )
        await alert(
          "Bank transfer: underpayment",
          `Order ${orderNo} paid ${match.amount} EUR but total ${total}. FIO txn ${match.id}. Manual review.`
        )
        continue
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
        fio_transaction_id: String(match.id),
        completed_by: "bank_transfer_reconcile_cron",
      }
      await pool.query(
        `UPDATE "order" SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb, updated_at = NOW() WHERE id = $2`,
        [JSON.stringify(stamp), ord.order_id]
      )

      await captureAndEmit(ord.order_id, pool, container, logger)

      logger.info(
        `[Bank Transfer Reconcile] ✅ Matched order ${orderNo} → FIO txn ${match.id} (${match.amount} EUR)`
      )
      await alert(
        "Bank transfer: payment reconciled",
        `Order ${orderNo} paid ${match.amount} EUR (FIO txn ${match.id}). Fulfillment released.`
      )
    }
  } catch (err: any) {
    logger.error(`[Bank Transfer Reconcile] job failed: ${err.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

export const config = {
  name: "bank-transfer-reconcile",
  schedule: "*/15 * * * *",
}
