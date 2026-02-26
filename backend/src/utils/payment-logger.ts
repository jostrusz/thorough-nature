// File: backend/src/utils/payment-logger.ts

import { Modules } from "@medusajs/framework/utils"

export type PaymentEventType =
  | "payment_initiated"
  | "payment_authorized"
  | "payment_captured"
  | "payment_failed"
  | "webhook_received"
  | "tracking_sent"
  | "refund_initiated"
  | "refund_completed"
  | "upsell_charged"
  | "upsell_session_created"

export type PaymentGateway =
  | "stripe"
  | "paypal"
  | "mollie"
  | "comgate"
  | "przelewy24"
  | "klarna"
  | "airwallex"

export interface PaymentActivityEvent {
  timestamp: string
  type: PaymentEventType
  gateway: PaymentGateway
  status: "success" | "failed" | "pending"
  amount?: number
  currency?: string
  transaction_id?: string
  payment_method?: string
  error_message?: string
  tracking_sent?: boolean
  raw_response?: Record<string, any>
}

/**
 * Logs a payment activity event to order metadata
 * Handles concurrent writes with retry logic
 *
 * @param orderService - MedusaJS OrderService
 * @param orderId - Order ID
 * @param event - Payment event details
 */
export async function logPaymentActivity(
  orderService: any,
  orderId: string,
  event: Omit<PaymentActivityEvent, "timestamp">
): Promise<void> {
  const maxRetries = 3
  let retries = 0
  let lastError: Error | null = null

  while (retries < maxRetries) {
    try {
      // Fetch current order with metadata
      const order = await orderService.retrieve(orderId, {
        select: ["id", "metadata"],
      })

      // Initialize or get existing payment_activity_log
      const currentMetadata = order.metadata || {}
      const paymentActivityLog: PaymentActivityEvent[] = currentMetadata.payment_activity_log || []

      // Create new event with timestamp
      const newEvent: PaymentActivityEvent = {
        ...event,
        timestamp: new Date().toISOString(),
      }

      // Append event
      paymentActivityLog.push(newEvent)

      // Update order metadata
      await orderService.update(orderId, {
        metadata: {
          ...currentMetadata,
          payment_activity_log: paymentActivityLog,
        },
      })

      return // Success - exit function
    } catch (error) {
      lastError = error as Error
      retries++

      if (retries < maxRetries) {
        // Exponential backoff: 100ms, 200ms, 400ms
        const delayMs = Math.pow(2, retries - 1) * 100
        await new Promise((resolve) => setTimeout(resolve, delayMs))
      }
    }
  }

  // If we get here, all retries failed
  console.error(
    `Failed to log payment activity for order ${orderId} after ${maxRetries} retries:`,
    lastError
  )
  throw new Error(
    `Failed to log payment activity: ${lastError?.message || "Unknown error"}`
  )
}

/**
 * Retrieves the payment activity log for an order
 *
 * @param orderService - MedusaJS OrderService
 * @param orderId - Order ID
 * @returns Array of payment activity events
 */
export async function getPaymentActivityLog(
  orderService: any,
  orderId: string
): Promise<PaymentActivityEvent[]> {
  const order = await orderService.retrieve(orderId, {
    select: ["id", "metadata"],
  })

  return order.metadata?.payment_activity_log || []
}

/**
 * Filters payment activity log by event type or gateway
 *
 * @param log - Full payment activity log
 * @param filter - Filter criteria
 * @returns Filtered events
 */
export function filterPaymentActivity(
  log: PaymentActivityEvent[],
  filter?: {
    type?: PaymentEventType
    gateway?: PaymentGateway
    status?: "success" | "failed" | "pending"
  }
): PaymentActivityEvent[] {
  if (!filter) return log

  return log.filter((event) => {
    if (filter.type && event.type !== filter.type) return false
    if (filter.gateway && event.gateway !== filter.gateway) return false
    if (filter.status && event.status !== filter.status) return false
    return true
  })
}
