// @ts-nocheck
import { getSharedPgPool } from "./pg-pool"

/**
 * Atomically merge a patch into order.metadata.
 *
 * Why not orderModuleService.updateOrders({ metadata: {...} })?
 * -------------------------------------------------------------
 * Passing only the new fields looks safe — several subscribers carry a comment
 * saying "Medusa merges metadata at DB level" — but the merge happens against
 * the metadata snapshot the ORM loaded when it fetched the order, not against
 * the current row. Two order.placed subscribers that both load the order, each
 * merge their own fields, and flush will therefore write
 *   snapshot + own fields
 * and the later flush silently drops whatever the earlier one added. Classic
 * lost update.
 *
 * Measured on production 2026-07-30 (133 orders in one window):
 *   custom_order_number / dextrum_status / email_activity_log survived on ~100 %
 *   payment_provider survived on 41 %, ntfy_notification_sent on 69 %
 * The survivors are the subscribers that write last or re-read before writing;
 * the losers are the ones that write early via updateOrders.
 *
 * `metadata = COALESCE(metadata, '{}') || $patch` is evaluated by Postgres
 * against the current row inside the UPDATE, so concurrent callers cannot
 * clobber each other regardless of ordering.
 *
 * Never throws — metadata bookkeeping must not break the order flow.
 * Returns true when a row was updated.
 */
export async function mergeOrderMetadata(
  orderId: string,
  patch: Record<string, any>,
  label = "metadata"
): Promise<boolean> {
  if (!orderId || !patch || Object.keys(patch).length === 0) return false
  try {
    const pool = getSharedPgPool()
    const { rowCount } = await pool.query(
      `UPDATE "order"
          SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb,
              updated_at = NOW()
        WHERE id = $2`,
      [JSON.stringify(patch), orderId]
    )
    return (rowCount || 0) > 0
  } catch (err: any) {
    console.error(`[${label}] atomic metadata merge failed for ${orderId}: ${err.message}`)
    return false
  }
}
