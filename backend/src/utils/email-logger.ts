// File: backend/src/utils/email-logger.ts
// Logs email sending events to order.metadata.email_activity_log
//
// Uses delayed retry with fresh metadata reads to avoid race conditions
// with other order.placed subscribers writing to metadata concurrently.

export interface EmailActivityEvent {
  timestamp: string
  template: string
  subject: string
  to: string
  status: "sent" | "failed"
  error_message?: string
  html_body?: string
}

/**
 * Logs an email event to order metadata.
 * Stores in order.metadata.email_activity_log array.
 *
 * Waits 4 seconds before first attempt to let other order.placed
 * subscribers finish their metadata writes, then retries with
 * exponential backoff if there's a conflict.
 */
export async function logEmailActivity(
  orderService: any,
  orderId: string,
  event: Omit<EmailActivityEvent, "timestamp">
): Promise<void> {
  const maxRetries = 5
  let retries = 0
  let lastError: Error | null = null

  // Wait 4s for other subscribers to finish writing metadata first
  await new Promise((r) => setTimeout(r, 4000))

  while (retries < maxRetries) {
    try {
      // Always re-read fresh metadata right before writing
      const order = await orderService.retrieveOrder(orderId, {
        select: ["id", "metadata"],
      })

      const currentMetadata = order.metadata || {}
      const emailLog: EmailActivityEvent[] =
        Array.isArray(currentMetadata.email_activity_log)
          ? [...currentMetadata.email_activity_log]
          : []

      // Check for duplicate (same template + to + status within 60s)
      const newTimestamp = new Date().toISOString()
      const isDuplicate = emailLog.some(
        (e) =>
          e.template === event.template &&
          e.to === event.to &&
          e.status === event.status &&
          Math.abs(new Date(e.timestamp).getTime() - new Date(newTimestamp).getTime()) < 60000
      )
      if (isDuplicate) {
        return // Already logged, skip
      }

      emailLog.push({
        ...event,
        timestamp: newTimestamp,
      })

      await orderService.updateOrders(orderId, {
        metadata: {
          ...currentMetadata,
          email_activity_log: emailLog,
        },
      })

      return
    } catch (error) {
      lastError = error as Error
      retries++
      if (retries < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s, 8s
        await new Promise((r) => setTimeout(r, Math.pow(2, retries - 1) * 1000))
      }
    }
  }

  console.error(
    `[email-logger] Failed to log email activity for order ${orderId} after ${maxRetries} retries:`,
    lastError?.message || lastError
  )
}
