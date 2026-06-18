// @ts-nocheck
import { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { logPaymentEvent } from "../modules/payment-debug/utils/log"

/**
 * Brite customer notifications — loslatenboek ONLY, Brite payments ONLY.
 *
 * Sends two lifecycle e-mails the standard order flow doesn't cover for async
 * open-banking payments:
 *   #2 lb-payment-pending  — transaction PENDING (1), no order yet, customer left.
 *   #4 lb-payment-recovery — session ABORTED/FAILED (10/11) AND transaction is
 *                            DEFINITIVELY unpaid (state 2/3/7 or none).
 *
 * Vincent-case guard: recovery is sent ONLY when the transaction is in a terminal
 * FAILED state (2 aborted / 3 failed / 7 debit) — NEVER when it is 0/1 (could still
 * settle) or 4/5/6 (paid). So a late settlement can never receive a "finish your
 * payment" e-mail.
 *
 * Idempotent: a 'brite_recovery_email' / 'brite_pending_email' marker is written to
 * payment_journey_log per session and re-checked before sending.
 *
 * Scoped hard to project_slug = 'loslatenboek' (the only checkout on the redirect
 * flow for now). Source of truth for email + session id = payment_journey_log
 * (brite_session_created events carry intent_id + email + project_slug).
 */

// Per-project config. A project is only processed if it appears here (so the cron is
// scoped to checkouts that are on the redirect flow + have payment lifecycle templates).
const PROJECTS: Record<string, {
  checkoutUrl: string; replyTo: string
  pendingTemplate: string; pendingSubject: string
  recoveryTemplate: string; recoverySubject: string
}> = {
  loslatenboek: {
    checkoutUrl: process.env.LLWJK_CHECKOUT_URL || "https://loslatenboek.nl/checkout",
    replyTo: "devries@loslatenboek.nl",
    pendingTemplate: "lb-payment-pending", pendingSubject: "we hebben je bestelling ontvangen",
    recoveryTemplate: "lb-payment-recovery", recoverySubject: "je bent er bijna",
  },
  "slapp-taget": {
    checkoutUrl: process.env.ST_CHECKOUT_URL || "https://slapptagetboken.se/checkout",
    replyTo: "hej@slapptagetboken.se",
    pendingTemplate: "st-payment-pending", pendingSubject: "Vi har tagit emot din beställning",
    recoveryTemplate: "st-payment-recovery", recoverySubject: "Du är nästan klar",
  },
}
const PROJECT_SLUGS = Object.keys(PROJECTS)

const PENDING_MIN_AGE_MS = 10 * 60 * 1000   // #2: tx pending ≥ 10 min
const RECOVERY_MIN_AGE_MS = 45 * 60 * 1000  // #4: aborted ≥ 45 min (late-settlement grace)
const WINDOW_MS = 24 * 60 * 60 * 1000        // only look back 24h
const MAX_PER_RUN = 50                        // runaway guard

async function getBriteCreds() {
  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  try {
    const { rows } = await pool.query(
      `SELECT mode, live_keys, test_keys FROM gateway_config
       WHERE provider = 'brite' AND is_active = true AND deleted_at IS NULL
       ORDER BY priority ASC LIMIT 1`
    )
    if (!rows[0]) return null
    const keys = rows[0].mode === "live" ? rows[0].live_keys : rows[0].test_keys
    if (!keys?.api_key || !keys?.secret_key) return null
    const baseUrl = rows[0].mode === "live"
      ? "https://production.britepaymentgroup.com"
      : "https://sandbox.britepaymentgroup.com"
    return { apiKey: keys.api_key, secret: keys.secret_key, baseUrl }
  } catch { return null } finally { await pool.end().catch(() => {}) }
}

export default async function briteCustomerNotify(container: MedusaContainer) {
  const logger = container.resolve("logger")
  // Safety gate: this cron sends AUTOMATIC customer e-mails. It stays dormant until
  // explicitly enabled via env (so a staging deploy sharing prod data can't fire real
  // mails before the flow is signed off). Set BRITE_NOTIFY_ENABLED=true to activate.
  if (process.env.BRITE_NOTIFY_ENABLED !== "true") return
  const creds = await getBriteCreds()
  if (!creds) return

  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })

  try {
    // 1) Candidate Brite sessions for loslatenboek in the last 24h that have an email
    //    and have NOT already been notified (no recovery/pending marker logged).
    const { rows: candidates } = await pool.query(
      `SELECT DISTINCT ON (j.intent_id) j.intent_id, j.cart_id, j.email, j.project_slug, j.occurred_at
       FROM payment_journey_log j
       WHERE j.event_type = 'brite_session_created'
         AND j.project_slug = ANY($1)
         AND j.email IS NOT NULL AND j.email <> ''
         AND j.occurred_at >= NOW() - INTERVAL '24 hours'
         AND NOT EXISTS (
           SELECT 1 FROM payment_journey_log m
           WHERE m.intent_id = j.intent_id
             AND m.event_type IN ('brite_recovery_email', 'brite_pending_email')
         )
       ORDER BY j.intent_id, j.occurred_at DESC`,
      [PROJECT_SLUGS]
    )
    if (!candidates.length) return

    // 2) Brite token
    let token = ""
    try {
      const r = await fetch(`${creds.baseUrl}/api/merchant.authorize`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ public_key: creds.apiKey, secret: creds.secret }),
      })
      const d = await r.json()
      token = d?.access_token || d?.token || ""
    } catch (e: any) { logger.warn(`[Brite Notify] authorize failed: ${e?.message}`); return }
    if (!token) return

    const notifications = container.resolve(Modules.NOTIFICATION)
    const now = Date.now()
    let sent = 0

    for (const c of candidates) {
      if (sent >= MAX_PER_RUN) break
      const cfg = PROJECTS[c.project_slug]
      if (!cfg) continue
      const sessionId = c.intent_id
      const ageMs = now - new Date(c.occurred_at).getTime()
      if (ageMs > WINDOW_MS) continue

      // Skip if ANY recent order exists for this Brite session OR for this customer's
      // e-mail. The e-mail check is the important one: it catches the customer who
      // abandoned THIS attempt but then succeeded on a SECOND attempt (different cart /
      // session, even a different payment method). Without it we'd nag someone who has
      // already bought — and risk pushing them into a duplicate payment.
      const { rows: ord } = await pool.query(
        `SELECT id FROM "order"
         WHERE (metadata->>'briteSessionId' = $1 OR lower(email) = lower($2))
           AND created_at >= NOW() - INTERVAL '7 days'
         LIMIT 1`,
        [sessionId, c.email]
      )
      if (ord[0]) continue

      // Fetch session + transaction state.
      let sessionState: number | null = null, txId: string | null = null, txState: number | null = null
      try {
        const sR = await fetch(`${creds.baseUrl}/api/session.get`, {
          method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ id: sessionId }),
        })
        const sD = await sR.json()
        if (typeof sD?.state === "number") sessionState = sD.state
        if (sD?.transaction_id) txId = sD.transaction_id
      } catch { continue }
      if (txId) {
        try {
          const tR = await fetch(`${creds.baseUrl}/api/transaction.get`, {
            method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({ id: txId }),
          })
          const tD = await tR.json()
          if (typeof tD?.state === "number") txState = tD.state
        } catch { /* keep null */ }
      }

      // Paid → nothing to do here (order flow / reconcile handles it).
      if (sessionState === 12 || [4, 5, 6].includes(Number(txState))) continue

      // First name from the cart's shipping address; localized fallback.
      let firstName = c.project_slug === "slapp-taget" ? "där" : "daar"
      try {
        const { rows: nm } = await pool.query(
          `SELECT ca.first_name FROM cart cc
           JOIN cart_address ca ON ca.id = cc.shipping_address_id
           WHERE cc.id = $1 LIMIT 1`,
          [c.cart_id]
        )
        if (nm[0]?.first_name) firstName = nm[0].first_name
      } catch { /* keep fallback */ }

      let template: string | null = null, subject = "", marker = ""
      let data: any = { emailOptions: { replyTo: cfg.replyTo, subject: "" }, firstName }

      if ([2, 3, 7].includes(Number(txState)) && ageMs >= RECOVERY_MIN_AGE_MS) {
        // #4 RECOVERY — transaction terminally failed (not a late-settlement candidate).
        template = cfg.recoveryTemplate
        subject = cfg.recoverySubject
        marker = "brite_recovery_email"
        data.checkoutUrl = cfg.checkoutUrl
      } else if (Number(txState) === 1 && ageMs >= PENDING_MIN_AGE_MS) {
        // #2 PENDING — transaction still processing, no order yet.
        template = cfg.pendingTemplate
        subject = cfg.pendingSubject
        marker = "brite_pending_email"
      }
      if (!template) continue

      data.emailOptions.subject = subject
      try {
        await notifications.createNotifications({
          to: c.email, channel: "email", template, data,
        })
        sent++
        logger.info(`[Brite Notify] Sent ${template} to ${c.email} (session ${sessionId}, tx state ${txState})`)
        await logPaymentEvent({
          intent_id: sessionId, email: c.email, cart_id: c.cart_id, project_slug: c.project_slug,
          event_type: marker, event_data: { template, tx_state: txState, session_state: sessionState },
        }).catch(() => {})
      } catch (e: any) {
        logger.warn(`[Brite Notify] send failed for ${c.email}: ${e?.message}`)
      }
    }

    if (sent) logger.info(`[Brite Notify] Done: ${sent} e-mail(s) sent.`)
  } catch (e: any) {
    logger.warn(`[Brite Notify] run failed: ${e?.message}`)
  } finally {
    await pool.end().catch(() => {})
  }
}

export const config = {
  name: "brite-customer-notify",
  schedule: "*/30 * * * *", // every 30 min
}
