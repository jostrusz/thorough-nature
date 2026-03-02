// File: backend/src/utils/email-logger.ts
// Logs email sending events to order.metadata.email_activity_log

import { Modules } from "@medusajs/framework/utils"

export interface EmailActivityEvent {
  timestamp: string
  template: string
  subject: string
  to: string
  status: "sent" | "failed"
  error_message?: string
}

/**
 * Logs an email event to order metadata.
 * Stores in order.metadata.email_activity_log array.
 */
export async function logEmailActivity(
  orderService: any,
  orderId: string,
  event: Omit<EmailActivityEvent, "timestamp">
): Promise<void> {
  const maxRetries = 3
  let retries = 0
  let lastError: Error | null = null

  while (retries < maxRetries) {
    try {
      const order = await orderService.retrieve(orderId, {
        select: ["id", "metadata"],
      })

      const currentMetadata = order.metadata || {}
      const emailLog: EmailActivityEvent[] =
        currentMetadata.email_activity_log || []

      emailLog.push({
        ...event,
        timestamp: new Date().toISOString(),
      })

      await orderService.update(orderId, {
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
        await new Promise((r) => setTimeout(r, Math.pow(2, retries - 1) * 100))
      }
    }
  }

  console.error(
    `[email-logger] Failed to log email activity for order ${orderId} after ${maxRetries} retries:`,
    lastError
  )
}
