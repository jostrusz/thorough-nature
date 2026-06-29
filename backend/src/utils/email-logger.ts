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
 * Strip C0 control characters (except tab / newline / carriage-return) from a
 * string.
 *
 * PostgreSQL JSONB rejects the NUL escape (backslash-u-0000) with
 * "unsupported Unicode escape sequence ... cannot be converted to text", so a
 * single NUL byte anywhere in the payload makes the whole
 * `update "order" set metadata = ...` statement fail. The email render
 * pipeline can emit a stray NUL for certain glyphs (e.g. the a-ring in the
 * Norwegian "Slipp taket pa" footer on some builds), which silently dropped
 * the email_activity_log AND blocked the order_confirmation_sent idempotency
 * flag. Sanitizing at the metadata boundary keeps the write safe regardless of
 * what the renderer produced.
 */
function stripControlChars(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
}

/**
 * Logs an email event to order metadata.
 * Stores in order.metadata.email_activity_log array.
 *
 * Waits 5 seconds before first attempt to let other order.placed
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

  // Wait 5s for other subscribers to finish writing metadata first
  await new Promise((r) => setTimeout(r, 5000))

  while (retries < maxRetries) {
    try {
      // Re-read fresh metadata — try multiple approaches for compatibility
      let currentMetadata: Record<string, any> = {}
      try {
        const order = await orderService.retrieveOrder(orderId)
        currentMetadata = order?.metadata || {}
      } catch {
        // Fallback: try listOrders
        try {
          const [order] = await orderService.listOrders({ id: orderId }, { select: ["id", "metadata"], take: 1 })
          currentMetadata = order?.metadata || {}
        } catch {
          // Last resort: just write without merging
          console.warn(`[email-logger] Could not read order ${orderId} metadata, writing fresh`)
        }
      }

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

      // Sanitize all string fields: a NUL / control byte in any of them makes
      // the JSONB metadata UPDATE fail (see stripControlChars above).
      emailLog.push({
        template: stripControlChars(event.template),
        subject: stripControlChars(event.subject),
        to: stripControlChars(event.to),
        status: event.status,
        ...(event.error_message ? { error_message: stripControlChars(event.error_message) } : {}),
        ...(event.html_body ? { html_body: stripControlChars(event.html_body) } : {}),
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
