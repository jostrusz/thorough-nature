/**
 * Facebook Conversions API (CAPI) helper.
 *
 * Sends server-side events to Facebook via the Graph API.
 * Uses native Node.js fetch + crypto — no external SDK needed.
 *
 * Key rules:
 *  - event_time in SECONDS (not ms)
 *  - All PII: lowercase → trim → SHA-256
 *  - client_ip_address and client_user_agent are NOT hashed
 *  - fbc and fbp cookies are NOT hashed
 *  - Retry 3× with exponential backoff on 5xx
 */
import { createHash } from "crypto"

// ─── Types ──────────────────────────────────────────────────────

export interface CAPIUserData {
  em?: string          // email
  ph?: string          // phone E.164 without +
  fn?: string          // first name
  ln?: string          // last name
  ct?: string          // city
  st?: string          // state/region
  zp?: string          // zip/postal code
  country?: string     // 2-letter ISO country
  external_id?: string // internal customer ID
  ge?: string          // gender m/f
  db?: string          // date of birth YYYYMMDD
  // NOT hashed:
  client_ip_address?: string
  client_user_agent?: string
  fbc?: string         // _fbc cookie
  fbp?: string         // _fbp cookie
}

export interface CAPICustomData {
  content_type?: string
  content_ids?: string[]
  content_name?: string
  value?: number
  currency?: string
  num_items?: number
  contents?: Array<{ id: string; quantity: number; item_price?: number }>
  order_id?: string
  [key: string]: any
}

export interface CAPIEvent {
  event_name: string
  event_id: string
  event_time: number        // Unix seconds
  event_source_url?: string
  action_source?: string
  user_data: CAPIUserData
  custom_data?: CAPICustomData
}

export interface CAPIConfig {
  pixel_id: string
  access_token: string
  test_event_code?: string | null
}

export interface CAPIResponse {
  success: boolean
  fbtrace_id?: string
  error?: string
  events_received?: number
}

// ─── SHA-256 hashing ────────────────────────────────────────────

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex")
}

/**
 * Normalize + hash a PII value:
 *  1. Convert to string
 *  2. Trim whitespace
 *  3. Lowercase
 *  4. SHA-256 hash
 */
export function hashPII(value: string | undefined | null): string | undefined {
  if (!value || value.trim() === "") return undefined
  const normalized = value.trim().toLowerCase()
  return sha256(normalized)
}

/**
 * Normalize a phone number before hashing:
 *  - Remove spaces, dashes, parentheses, dots
 *  - Remove leading +
 *  - Lowercase (no-op for digits, but safe)
 *  - SHA-256 hash
 */
export function hashPhone(value: string | undefined | null): string | undefined {
  if (!value || value.trim() === "") return undefined
  const cleaned = value.replace(/[\s\-().+]/g, "").trim().toLowerCase()
  if (!cleaned) return undefined
  return sha256(cleaned)
}

// ─── Build hashed user_data ─────────────────────────────────────

export function buildHashedUserData(raw: CAPIUserData): Record<string, any> {
  const hashed: Record<string, any> = {}

  // Hashed PII fields
  if (raw.em) hashed.em = [hashPII(raw.em)]
  if (raw.ph) hashed.ph = [hashPhone(raw.ph)]
  if (raw.fn) hashed.fn = [hashPII(raw.fn)]
  if (raw.ln) hashed.ln = [hashPII(raw.ln)]
  if (raw.ct) hashed.ct = [hashPII(raw.ct)]
  if (raw.st) hashed.st = [hashPII(raw.st)]
  if (raw.zp) hashed.zp = [hashPII(raw.zp)]
  if (raw.country) hashed.country = [hashPII(raw.country)]
  if (raw.external_id) hashed.external_id = [hashPII(raw.external_id)]
  if (raw.ge) hashed.ge = [hashPII(raw.ge)]
  if (raw.db) hashed.db = [hashPII(raw.db)]

  // NOT hashed
  if (raw.client_ip_address) hashed.client_ip_address = raw.client_ip_address
  if (raw.client_user_agent) hashed.client_user_agent = raw.client_user_agent
  if (raw.fbc) hashed.fbc = raw.fbc
  if (raw.fbp) hashed.fbp = raw.fbp

  return hashed
}

// ─── Send CAPI event ────────────────────────────────────────────

const GRAPH_API_VERSION = "v21.0"
const MAX_RETRIES = 3
const BASE_DELAY_MS = 1000

export async function sendCAPIEvents(
  config: CAPIConfig,
  events: CAPIEvent[]
): Promise<CAPIResponse> {
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${config.pixel_id}/events`

  const payload: Record<string, any> = {
    data: events.map((ev) => ({
      event_name: ev.event_name,
      event_id: ev.event_id,
      event_time: ev.event_time,
      event_source_url: ev.event_source_url || undefined,
      action_source: ev.action_source || "website",
      user_data: buildHashedUserData(ev.user_data),
      custom_data: ev.custom_data || undefined,
    })),
    access_token: config.access_token,
  }

  if (config.test_event_code) {
    payload.test_event_code = config.test_event_code
  }

  let lastError = ""

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const body = await response.json()

      if (response.ok) {
        console.log(
          `[META CAPI] ✓ Sent ${events.length} event(s) to pixel ${config.pixel_id}:`,
          events.map((e) => `${e.event_name}[${e.event_id.slice(0, 8)}]`).join(", "),
          `| fbtrace_id: ${body.fbtrace_id || "n/a"}`
        )
        return {
          success: true,
          fbtrace_id: body.fbtrace_id,
          events_received: body.events_received,
        }
      }

      // 4xx = client error, don't retry
      if (response.status >= 400 && response.status < 500) {
        const errMsg =
          body?.error?.message || body?.error?.error_user_msg || JSON.stringify(body)
        console.error(
          `[META CAPI] ✗ Client error (${response.status}) for pixel ${config.pixel_id}:`,
          errMsg
        )
        return { success: false, error: errMsg }
      }

      // 5xx = server error, retry with backoff
      lastError = `HTTP ${response.status}: ${body?.error?.message || "Server error"}`
      console.warn(
        `[META CAPI] ⚠ Server error (${response.status}), attempt ${attempt + 1}/${MAX_RETRIES}`
      )
    } catch (err: any) {
      lastError = err.message || "Network error"
      console.warn(
        `[META CAPI] ⚠ Network error, attempt ${attempt + 1}/${MAX_RETRIES}:`,
        lastError
      )
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((r) => setTimeout(r, BASE_DELAY_MS * Math.pow(2, attempt)))
    }
  }

  console.error(
    `[META CAPI] ✗ All ${MAX_RETRIES} attempts failed for pixel ${config.pixel_id}:`,
    lastError
  )
  return { success: false, error: lastError }
}
