import { Pool } from "pg"

/**
 * logPaymentEvent — fire-and-forget write to payment_journey_log.
 *
 * Design:
 *   - Never throws. Observability code must not break production flow.
 *   - Raw pg pool so it works in both module-scoped (service) and
 *     request-scoped (route) contexts without Medusa DI needs.
 *   - Short TTL pool (1 conn, 5s idle) — called sparsely.
 *   - Best-effort truncation of oversized fields so a pathological
 *     payload can't OOM us.
 *
 * Caller shapes of event_data are free-form. Suggested fields by event:
 *   checkout_viewed         { total, currency, items_count, bundle_qty, utm }
 *   payment_methods_loaded  { methods: string[], count, provider_counts }
 *   payment_method_selected { method, provider_id, time_on_page_ms }
 *   submit_clicked          { method, provider_id, amount, currency }
 *   payment_return          { status, intent_id, query: {...} }
 *   airwallex_intent_created     { intent_id, amount, currency, method, request_id }
 *   airwallex_confirm_request    { intent_id, method, payload_safe }
 *   airwallex_confirm_response   { intent_id, status, next_action_url, error_code }
 *   airwallex_webhook_received   { event_name, intent_id, status, failure_reason }
 */

export type PaymentEvent = {
  intent_id?: string | null
  cart_id?: string | null
  email?: string | null
  project_slug?: string | null
  event_type: string
  event_data?: Record<string, any> | null
  error_code?: string | null
  user_agent?: string | null
  referrer?: string | null
  ip_address?: string | null
  occurred_at?: Date
}

const MAX_UA = 1024
const MAX_REF = 1024
const MAX_IP = 64
const MAX_EMAIL = 320
const MAX_PROJECT = 64
const MAX_EVENT_TYPE = 64
const MAX_ERROR_CODE = 128
const MAX_JSON_BYTES = 16 * 1024 // 16 KB per event — very generous

// Shared pool across calls. Lazy-init on first use.
let _pool: Pool | null = null
function pool(): Pool | null {
  if (_pool) return _pool
  if (!process.env.DATABASE_URL) return null
  _pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
    idleTimeoutMillis: 5000,
    connectionTimeoutMillis: 2000,
  })
  return _pool
}

function trim(v: any, max: number): string | null {
  if (v == null) return null
  const s = String(v)
  if (!s) return null
  return s.length > max ? s.slice(0, max) : s
}

function truncatePayload(data: any): any {
  if (data == null) return null
  try {
    const json = JSON.stringify(data)
    if (Buffer.byteLength(json, "utf8") <= MAX_JSON_BYTES) return data
    // Oversized — keep only top-level keys with short values
    const out: Record<string, any> = { _truncated: true, _original_bytes: Buffer.byteLength(json, "utf8") }
    for (const [k, v] of Object.entries(data || {})) {
      const sv = JSON.stringify(v)
      if (sv && Buffer.byteLength(sv, "utf8") < 512) out[k] = v
    }
    return out
  } catch {
    return { _serialization_failed: true }
  }
}

/**
 * Generate a ULID-like id so rows sort chronologically. We use Date.now()
 * for the time part (good enough for sort), padded with random hex.
 */
function newId(): string {
  const t = Date.now().toString(36).padStart(10, "0")
  const r = Math.random().toString(36).slice(2, 14).padStart(12, "0")
  return `pje_${t}${r}`
}

export async function logPaymentEvent(ev: PaymentEvent): Promise<void> {
  try {
    const p = pool()
    if (!p) return

    const id = newId()
    const occurred = ev.occurred_at || new Date()
    await p.query(
      `INSERT INTO payment_journey_log
        (id, intent_id, cart_id, email, project_slug, event_type, event_data,
         error_code, user_agent, referrer, ip_address, occurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        trim(ev.intent_id, 128),
        trim(ev.cart_id, 128),
        trim(ev.email, MAX_EMAIL)?.toLowerCase() ?? null,
        trim(ev.project_slug, MAX_PROJECT),
        trim(ev.event_type, MAX_EVENT_TYPE) ?? "unknown",
        ev.event_data != null ? JSON.stringify(truncatePayload(ev.event_data)) : null,
        trim(ev.error_code, MAX_ERROR_CODE),
        trim(ev.user_agent, MAX_UA),
        trim(ev.referrer, MAX_REF),
        trim(ev.ip_address, MAX_IP),
        occurred,
      ]
    )
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn("[payment-debug] log write failed:", err?.message || err)
  }
}
