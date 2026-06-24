import { Resend } from "resend"
import { decryptSecret } from "../utils/crypto"

/**
 * ResendMarketingClient — thin wrapper around the Resend SDK that isolates
 * the marketing module from the transactional Medusa Notification provider.
 *
 * IMPORTANT ARCHITECTURE NOTE:
 *   This client is NOT registered as a Medusa Notification Provider and it
 *   NEVER calls `notificationModuleService.createNotifications()`. That means
 *   nothing it does can disturb the existing email-notifications module,
 *   order-placed subscribers, or abandoned cart cron job.
 *
 * Key resolution order:
 *   1. per-brand override in marketing_brand.resend_api_key_encrypted
 *      (decrypted via MARKETING_KEYSTORE_SECRET)
 *   2. global MARKETING_RESEND_API_KEY env var
 *   3. fall back to RESEND_API_KEY (same account as transactional)
 *
 * With the "single Resend account, multiple verified domains" strategy the
 * common case is that we use the global key and each brand simply specifies
 * its own verified `marketing_from_email` (e.g. news@news.loslatenboek.nl).
 */

type MinimalBrand = {
  id: string
  slug: string
  resend_api_key_encrypted?: string | null
}

function resolveApiKey(brand: MinimalBrand): string {
  const perBrand = brand.resend_api_key_encrypted
    ? decryptSecret(brand.resend_api_key_encrypted)
    : null
  const key =
    perBrand ||
    process.env.MARKETING_RESEND_API_KEY ||
    process.env.RESEND_API_KEY
  if (!key) {
    throw new Error(
      `No Resend API key available for brand "${brand.slug}". ` +
        `Set MARKETING_RESEND_API_KEY env var or configure a per-brand override.`
    )
  }
  return key
}

export type SendEmailParams = {
  to: string
  from: string               // already formatted as "Name <email@domain>"
  replyTo?: string | null
  subject: string
  html: string
  text?: string
  headers?: Record<string, string>
  tags?: { name: string; value: string }[]
}

export type SendEmailResult = {
  resend_id: string | null
  ok: boolean
  error?: string
}

export class ResendMarketingClient {
  private client: Resend

  constructor(brand: MinimalBrand) {
    this.client = new Resend(resolveApiKey(brand))
  }

  async send(params: SendEmailParams): Promise<SendEmailResult> {
    // Retry transient failures (rate-limit 429 / 5xx) with exponential backoff.
    // The Resend SDK returns { data, error } rather than throwing on API errors,
    // so we inspect both the returned error and any thrown exception.
    const MAX_ATTEMPTS = 4
    let lastError = "unknown"
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const result = await this.client.emails.send({
          from: params.from,
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
          replyTo: params.replyTo ?? undefined,
          headers: params.headers,
          tags: params.tags,
        } as any)
        const id = (result as any)?.data?.id ?? null
        if (id) return { resend_id: id, ok: true }
        const err = (result as any)?.error
        lastError = err?.message || err?.name || "no_id_returned"
        if (!isTransient(err) || attempt === MAX_ATTEMPTS) {
          return { resend_id: null, ok: false, error: lastError }
        }
      } catch (err: any) {
        lastError = err?.message || String(err)
        if (!isTransient(err) || attempt === MAX_ATTEMPTS) {
          return { resend_id: null, ok: false, error: lastError }
        }
      }
      // backoff: 500ms, 1s, 2s
      await new Promise((r) => setTimeout(r, 500 * 2 ** (attempt - 1)))
    }
    return { resend_id: null, ok: false, error: lastError }
  }
}

/** Rate-limit (429) and 5xx are worth retrying; 4xx validation errors are not. */
function isTransient(err: any): boolean {
  if (!err) return false
  const code = Number(err.statusCode ?? err.status ?? 0)
  const name = String(err.name || "").toLowerCase()
  const msg = String(err.message || "").toLowerCase()
  if (code === 429 || (code >= 500 && code <= 599)) return true
  return name.includes("rate_limit") || msg.includes("rate limit") || msg.includes("too many requests")
}
