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

    // Set flag immediately BEFORE processing to prevent race conditions
    await orderModuleService.updateOrders(orderId, {
      metadata: {
        ...metadata,
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
