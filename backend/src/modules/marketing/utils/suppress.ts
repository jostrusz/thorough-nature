// @ts-nocheck
import type MarketingModuleService from "../service"

/**
 * Adding an address to the suppression list is idempotent by intent: once an
 * address is suppressed we never want to mail it again, and a second attempt to
 * record that fact is a no-op, not a failure.
 *
 * The table enforces this with a unique index on (brand_id, lower(email)) where
 * deleted_at is null, so a repeat insert throws. Callers that let it throw turn
 * a harmless duplicate into a 5xx — and for webhook handlers that means the
 * sender retries the same event forever and eventually disables the endpoint.
 * That is exactly what happened to the Resend marketing webhook: repeat
 * email.bounced / email.complained deliveries for already-suppressed addresses
 * returned 500 on every retry.
 *
 * Returns true when a new row was written, false when it already existed.
 * Genuine failures are still surfaced to the caller.
 */
export async function suppressEmail(
  service: MarketingModuleService,
  input: {
    brand_id: string
    email: string
    reason: string
    source_message_id?: string | null
    suppressed_at: Date
    metadata?: Record<string, unknown> | null
  }
): Promise<boolean> {
  try {
    await service.createMarketingSuppressions(input as any)
    return true
  } catch (err: any) {
    if (isDuplicateSuppression(err)) return false
    throw err
  }
}

/**
 * Postgres reports the unique-index violation as 23505, but the error reaches us
 * through MikroORM/Medusa wrappers that sometimes only preserve the message —
 * hence matching on both. Medusa's own phrasing is "… already exists".
 */
export function isDuplicateSuppression(err: any): boolean {
  if (err?.code === "23505") return true
  const msg = String(err?.message || err || "").toLowerCase()
  return (
    msg.includes("duplicate key") ||
    msg.includes("unique constraint") ||
    msg.includes("already exists")
  )
}
