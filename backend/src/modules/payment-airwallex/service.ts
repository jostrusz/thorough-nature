// @ts-nocheck
import {
  PaymentProviderError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { AirwallexApiClient } from "./api-client"

/**
 * Airwallex payment session data interface
 */
interface IAirwallexPaymentSessionData {
  intentId?: string
  clientSecret?: string
  status?: string
  amount?: number
  currency?: string
  metadata?: Record<string, any>
}

/**
 * Airwallex Payment Provider for MedusaJS 2.0
 * Supports card payments (credit/debit) and various payment methods
 */
export class AirwallexPaymentProvider {
  static identifier = "airwallex"

  protected container_: any
  protected options_: any
  private apiClient: AirwallexApiClient | null = null
  private logger: any

  constructor(container: any, options?: any) {
    this.container_ = container
    this.options_ = options || {}
    try {
      this.logger = container.resolve("logger")
    } catch {
      this.logger = console
    }
  }

  private getLogger() {
    if (!this.logger) {
      try { this.logger = this.container_.resolve("logger") } catch { this.logger = console }
    }
    return this.logger
  }

  /**
   * Get or initialize Airwallex API client
   */
  private async getAirwallexClient(): Promise<AirwallexApiClient> {
    if (this.apiClient) {
      return this.apiClient
    }

    const credentials = this.options_

    if (!credentials?.api_key || !credentials?.secret_key) {
      throw new PaymentProviderError(
        "Missing Airwallex credentials: api_key (client_id) and secret_key (api_key) required"
      )
    }

    const isTest = credentials?.is_test !== false // Default to test

    this.apiClient = new AirwallexApiClient(
      credentials.api_key,
      credentials.secret_key,
      isTest,
      this.getLogger()
    )

    // Initial login
    await this.apiClient.login()

    return this.apiClient
  }

  /**
   * Map Airwallex payment intent status to MedusaJS payment session status
   */
  private mapAirwallexStatusToMedusa(
    airwallexStatus: string
  ): PaymentSessionStatus {
    const statusMap: Record<string, PaymentSessionStatus> = {
      REQUIRES_PAYMENT_METHOD: PaymentSessionStatus.PENDING,
      REQUIRES_CUSTOMER_ACTION: PaymentSessionStatus.REQUIRES_MORE,
      REQUIRES_CAPTURE: PaymentSessionStatus.AUTHORIZED,
      SUCCEEDED: PaymentSessionStatus.AUTHORIZED,
      CAPTURED: PaymentSessionStatus.CAPTURED,
      CANCELLED: PaymentSessionStatus.CANCELED,
      FAILED: PaymentSessionStatus.ERROR,
    }

    return statusMap[airwallexStatus] || PaymentSessionStatus.PENDING
  }

  /**
   * Initiate payment — create payment intent
   * Returns client_secret for frontend to complete payment
   */
  async initiatePayment(
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()

      const {
        amount,
        currency,
        merchant_order_id,
        descriptor,
        return_url,
        metadata,
      } = context

      if (!amount || !currency || !merchant_order_id) {
        throw new PaymentProviderError(
          "Missing required fields: amount, currency, merchant_order_id"
        )
      }

      // Create payment intent
      const paymentIntent = await client.createPaymentIntent({
        amount,
        currency: currency.toUpperCase(),
        merchant_order_id,
        descriptor: descriptor?.substring(0, 22), // Max 22 chars
        return_url,
        metadata,
      })

      const sessionData: IAirwallexPaymentSessionData = {
        intentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      }

      this.getLogger().info(
        `[Airwallex] Payment initiated for order ${merchant_order_id}, intent: ${paymentIntent.id}`
      )

      return {
        session_data: sessionData,
        status: this.mapAirwallexStatusToMedusa(paymentIntent.status),
      }
    } catch (error: any) {
      this.getLogger().error(`[Airwallex] Initiate payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Authorize payment — confirm payment intent status
   */
  async authorizePayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (!intentId) {
        throw new PaymentProviderError("Missing payment intent ID")
      }

      // Get current payment intent status
      const paymentIntent = await client.getPaymentIntent(intentId)

      const updatedData: IAirwallexPaymentSessionData = {
        ...paymentSessionData,
        status: paymentIntent.status,
      }

      this.getLogger().info(
        `[Airwallex] Payment authorized, intent: ${intentId}, status: ${paymentIntent.status}`
      )

      return {
        session_data: updatedData,
        status: this.mapAirwallexStatusToMedusa(paymentIntent.status),
      }
    } catch (error: any) {
      this.getLogger().error(`[Airwallex] Authorize payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Capture payment — capture authorized amount
   */
  async capturePayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId, amount } = paymentSessionData

      if (!intentId) {
        throw new PaymentProviderError("Missing payment intent ID")
      }

      // Capture the payment intent
      const paymentIntent = await client.capturePaymentIntent(intentId, {
        amount,
      })

      const updatedData: IAirwallexPaymentSessionData = {
        ...paymentSessionData,
        status: paymentIntent.status,
      }

      this.getLogger().info(
        `[Airwallex] Payment captured, intent: ${intentId}, amount: ${amount}`
      )

      return {
        session_data: updatedData,
        status: this.mapAirwallexStatusToMedusa(paymentIntent.status),
      }
    } catch (error: any) {
      this.getLogger().error(`[Airwallex] Capture payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (!intentId) {
        throw new PaymentProviderError("Missing payment intent ID")
      }

      // Create refund
      const refund = await client.createRefund({
        payment_intent_id: intentId,
        amount: refundAmount > 0 ? refundAmount : undefined,
        reason: context?.reason || "Customer requested",
      })

      const updatedData: IAirwallexPaymentSessionData = {
        ...paymentSessionData,
        metadata: {
          ...paymentSessionData.metadata,
          refundId: refund.id,
          refundStatus: refund.status,
        },
      }

      this.getLogger().info(
        `[Airwallex] Refund created, intent: ${intentId}, refund: ${refund.id}, amount: ${refund.amount}`
      )

      return {
        session_data: updatedData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Airwallex] Refund payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (intentId) {
        // Cancel the payment intent
        await client.cancelPaymentIntent(intentId)
      }

      this.getLogger().info(`[Airwallex] Payment cancelled, intent: ${intentId}`)

      return {
        session_data: {
          ...paymentSessionData,
          status: "CANCELLED",
        },
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Airwallex] Cancel payment failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    // Cancel if not already cancelled
    if (paymentSessionData.status !== "CANCELLED") {
      return await this.cancelPayment(paymentSessionData, context)
    }

    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<PaymentSessionStatus> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (!intentId) {
        return PaymentSessionStatus.PENDING
      }

      const paymentIntent = await client.getPaymentIntent(intentId)
      return this.mapAirwallexStatusToMedusa(paymentIntent.status)
    } catch (error: any) {
      this.getLogger().error(
        `[Airwallex] Get payment status failed: ${error.message}`
      )
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IAirwallexPaymentSessionData,
    context: any
  ): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    try {
      const client = await this.getAirwallexClient()
      const { intentId } = paymentSessionData

      if (!intentId) {
        return {
          session_data: paymentSessionData,
          status: PaymentSessionStatus.PENDING,
        }
      }

      const paymentIntent = await client.getPaymentIntent(intentId)

      const updatedData: IAirwallexPaymentSessionData = {
        ...paymentSessionData,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      }

      return {
        session_data: updatedData,
        status: this.mapAirwallexStatusToMedusa(paymentIntent.status),
      }
    } catch (error: any) {
      this.getLogger().error(
        `[Airwallex] Retrieve payment failed: ${error.message}`
      )
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<{
    session_data: IAirwallexPaymentSessionData
    status: PaymentSessionStatus
  }> {
    return await this.retrievePayment(context.paymentSessionData, context)
  }

  /**
   * Process Airwallex webhook
   * Airwallex sends notifications for payment status changes
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: IAirwallexPaymentSessionData
  }> {
    try {
      const { id, event_type, data: eventData } = webhookData

      if (!id) {
        return {
          action: "neutral",
          data: webhookData as IAirwallexPaymentSessionData,
        }
      }

      const client = await this.getAirwallexClient()

      // Get updated payment intent status from Airwallex
      const paymentIntent = await client.getPaymentIntent(id)

      let action = "neutral"

      // Map webhook event to action
      if (event_type === "payment_intent.succeeded") {
        action = "succeed"
      } else if (event_type === "payment_intent.requires_customer_action") {
        action = "require_customer_action"
      } else if (event_type === "payment_intent.failed") {
        action = "fail"
      } else if (event_type === "payment_intent.cancelled") {
        action = "fail"
      }

      const sessionData: IAirwallexPaymentSessionData = {
        intentId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        metadata: paymentIntent.metadata,
      }

      this.getLogger().info(
        `[Airwallex] Webhook processed: ${event_type}, intent: ${id}, action: ${action}`
      )

      return {
        action,
        data: sessionData,
      }
    } catch (error: any) {
      this.getLogger().error(
        `[Airwallex] Webhook processing failed: ${error.message}`
      )
      return {
        action: "fail",
        data: webhookData as IAirwallexPaymentSessionData,
      }
    }
  }
}
