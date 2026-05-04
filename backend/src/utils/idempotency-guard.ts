/**
 * Idempotency guard for order.placed subscribers.
 *
 * Prevents duplicate processing when the same event fires twice
 * (e.g. after server restart during deploy).
 *
 * Uses a metadata flag on the order to track whether a subscriber
 * has already processed this order. The flag is set BEFORE processing
 * to minimize the race window.
 *
 * @returns true if the subscriber should SKIP (already processed)
 */
export async function shouldSkipDuplicate(
  orderModuleService: any,
  orderId: string,
  flagName: string,
  subscriberLabel: string
): Promise<boolean> {
  try {
    const order = await orderModuleService.retrieveOrder(orderId)
    const metadata = (order as any).metadata || {}

    if (metadata[flagName] === true) {
      console.log(
        `[${subscriberLabel}] Skipping duplicate for ${orderId} — already processed (${flagName}=true)`
      )
      return true
    }

    // Set flag immediately BEFORE processing to prevent race conditions.
    // Pass ONLY the new field — Medusa merges metadata at DB level. Spreading
    // the snapshot races with other order.placed subscribers writing concurrently
    // and silently overwrites their fields (fixed in commit 3d905ab9 for the
    // individual subscribers, but the guard itself was missed). Empty result on
    // re-read means the flag got wiped, which is what allowed the same Meta
    // Purchase event to be sent twice for the same order in rare cases.
    await orderModuleService.updateOrders(orderId, {
      metadata: {
        [flagName]: true,
      },
    })

    return false
  } catch (err: any) {
    console.warn(
      `[${subscriberLabel}] Idempotency check failed for ${orderId}, proceeding anyway:`,
      err.message
    )
    return false
  }
}
