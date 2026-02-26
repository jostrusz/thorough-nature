// @ts-nocheck
import {
  AbstractPaymentProvider,
  PaymentProviderError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { MollieApiClient } from "./api-client"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

export interface IMolliePaymentSessionData {
  mollieOrderId?: string
  molliePaymentId?: string
  status?: string
  method?: string
  amount?: number
  currency?: string
  createdAt?: number
  checkoutUrl?: string | null
}

/**
 * Maps Mollie order/payment statuses to Medusa payment session statuses
 */
function mapMollieStatusToMedusa(mollieStatus: string): PaymentSessionStatus {
  switch (mollieStatus) {
    case "paid":
      return PaymentSessionStatus.CAPTURED
    case "authorized":
      return PaymentSessionStatus.AUTHORIZED
    case "completed":
      return PaymentSessionStatus.CAPTURED
    case "pending":
      return PaymentSessionStatus.PENDING
    case "processing":
      return PaymentSessionStatus.PENDING
    case "expired":
      return PaymentSessionStatus.CANCELED
    case "canceled":
      return PaymentSessionStatus.CANCELED
    case "failed":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Mollie payment provider service — Medusa v2 Payment Module Provider
 * Uses Mollie Payments API for all methods (iDEAL, Bancontact, credit card, PayPal, etc.)
 */
class MolliePaymentProviderService extends AbstractPaymentProvider {
  protected client_: MollieApiClient | null = null
  protected gatewayConfigService_: any
  protected logger_: any

  static identifier = "mollie"

  constructor(container: any, options?: any) {
    super(container, options)
    try {
      this.logger_ = container.resolve("logger")
    } catch {
      this.logger_ = console
    }
    try {
      this.gatewayConfigService_ = container.resolve(GATEWAY_CONFIG_MODULE)
    } catch {
      this.gatewayConfigService_ = null
    }
  }

  private getLogger() {
    if (!this.logger_) {
      try { this.logger_ = this.container_.resolve("logger") } catch { this.logger_ = console }
    }
    return this.logger_
  }

  private getGatewayConfigService() {
    if (!this.gatewayConfigService_) {
      this.gatewayConfigService_ = this.container_.resolve(GATEWAY_CONFIG_MODULE)
    }
    return this.gatewayConfigService_
  }

  /**
   * Initialize the Mollie API client with credentials from gateway_config
   */
  private async getMollieClient(): Promise<MollieApiClient> {
    if (!this.client_) {
      const gcService = this.getGatewayConfigService()
      const configs = await gcService.listGatewayConfigs(
        { provider: "mollie", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (!config) {
        throw new PaymentProviderError("Mollie gateway not configured")
      }
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      if (!keys?.api_key) {
        throw new PaymentProviderError("Mollie API key not configured")
      }
      this.client_ = new MollieApiClient(keys.api_key, !isLive)
    }
    return this.client_
  }

  /**
   * Initiate a payment session — create a Mollie payment via Payments API
   * All methods (iDEAL, Bancontact, credit card, etc.) use the same flow.
   * Klarna uses a separate provider (payment-klarna).
   *
   * Medusa v2 input format:
   *   { amount, currency_code, data?: { method, cardToken, return_url }, context?: { customer } }
   */
  async initiatePayment(input: any): Promise<any> {
    const { amount, currency_code, data, context } = input

    try {
      const client = await this.getMollieClient()

      // Read frontend-provided session data
      const paymentMethod = data?.method || null
      const cardToken = data?.cardToken || null
      const returnUrl = data?.return_url
      const customer = context?.customer

      // Build webhook URL from backend env
      const backendUrl =
        process.env.BACKEND_PUBLIC_URL ||
        (process.env.RAILWAY_PUBLIC_DOMAIN_VALUE
          ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN_VALUE}`
          : "http://localhost:9000")
      const webhookUrl = `${backendUrl}/webhooks/mollie`

      this.getLogger().info(
        `[Mollie] Creating payment: method=${paymentMethod}, amount=${(amount / 100).toFixed(2)} ${currency_code}, returnUrl=${returnUrl}, webhookUrl=${webhookUrl}`
      )

      // Build Mollie payment request (Payments API)
      const paymentData: any = {
        amount: {
          value: (amount / 100).toFixed(2),
          currency: currency_code.toUpperCase(),
        },
        description: `Order ${Date.now()}`,
        redirectUrl: returnUrl || "https://example.com",
        webhookUrl: webhookUrl,
        metadata: {
          customer_id: customer?.id,
          customer_email: customer?.email,
        },
      }

      if (paymentMethod) {
        paymentData.method = paymentMethod
      }
      if (cardToken) {
        paymentData.cardToken = cardToken
      }

      const result = await client.createPayment(paymentData)
      if (!result.success) {
        throw new PaymentProviderError(
          result.error || "Failed to create Mollie payment"
        )
      }

      const molliePayment = result.data
      const checkoutUrl = molliePayment._links?.checkout?.href || null

      this.getLogger().info(
        `[Mollie] Payment created: ${molliePayment.id}, status: ${molliePayment.status}, checkout: ${checkoutUrl || "none"}`
      )

      const sessionData: IMolliePaymentSessionData = {
        molliePaymentId: molliePayment.id,
        status: molliePayment.status,
        method: paymentMethod,
        amount,
        currency: currency_code,
        createdAt: Date.now(),
        checkoutUrl,
      }

      return { session_data: sessionData }
    } catch (error: any) {
      this.getLogger().error(
        `[Mollie] Payment initiation failed: ${error.message}`
      )
      throw new PaymentProviderError(
        error.message || "Failed to initiate Mollie payment"
      )
    }
  }

  /**
   * Authorize payment — check Mollie payment status
   */
  async authorizePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getMollieClient()
      const { molliePaymentId, mollieOrderId } = paymentSessionData

      // Payments API (primary flow)
      if (molliePaymentId) {
        const result = await client.getPayment(molliePaymentId)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to fetch Mollie payment")
        }
        const status = mapMollieStatusToMedusa(result.data.status)
        this.getLogger().info(`[Mollie] Authorize check: ${molliePaymentId} → ${result.data.status} → ${status}`)
        return {
          session_data: { ...paymentSessionData, status: result.data.status },
          status,
        }
      }

      // Legacy: Orders API fallback
      if (mollieOrderId) {
        const result = await client.getOrder(mollieOrderId)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to fetch Mollie order")
        }
        const status = mapMollieStatusToMedusa(result.data.status)
        return {
          session_data: { ...paymentSessionData, status: result.data.status },
          status,
        }
      }

      throw new PaymentProviderError("No Mollie payment or order ID in session data")
    } catch (error: any) {
      this.getLogger().error(`[Mollie] Authorization check failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Capture payment — check current status from Mollie
   */
  async capturePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getMollieClient()
      const { molliePaymentId, mollieOrderId } = paymentSessionData

      if (molliePaymentId) {
        const result = await client.getPayment(molliePaymentId)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to fetch Mollie payment")
        }
        const status = mapMollieStatusToMedusa(result.data.status)
        return {
          session_data: { ...paymentSessionData, status: result.data.status },
          status,
        }
      }

      if (mollieOrderId) {
        const result = await client.getOrder(mollieOrderId)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to fetch Mollie order")
        }
        const status = mapMollieStatusToMedusa(result.data.status)
        return {
          session_data: { ...paymentSessionData, status: result.data.status },
          status,
        }
      }

      throw new PaymentProviderError("No Mollie payment or order ID in session data")
    } catch (error: any) {
      this.getLogger().error(`[Mollie] Capture failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IMolliePaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getMollieClient()
      const { mollieOrderId } = paymentSessionData

      if (!mollieOrderId) {
        throw new PaymentProviderError("No Mollie order ID in session data")
      }

      const refundData = {
        description: `Refund ${(refundAmount / 100).toFixed(2)}`,
      }

      const result = await client.createRefund(mollieOrderId, refundData)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create refund")
      }

      this.getLogger().info(
        `[Mollie] Refund created for order ${mollieOrderId}: ${result.data.id}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Mollie] Refund failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<any> {
    try {
      const { mollieOrderId } = paymentSessionData

      if (!mollieOrderId) {
        throw new PaymentProviderError("No Mollie order ID in session data")
      }

      // Mollie doesn't have a direct cancel endpoint for orders
      // The order will expire after 28 days if unpaid
      // Log the cancellation intent
      this.getLogger().info(`[Mollie] Order ${mollieOrderId} marked for cancellation`)

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Mollie] Cancel failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<any> {
    // No-op for Mollie — cleanup handled server-side
    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<PaymentSessionStatus> {
    try {
      const client = await this.getMollieClient()
      const { molliePaymentId, mollieOrderId } = paymentSessionData

      if (molliePaymentId) {
        const result = await client.getPayment(molliePaymentId)
        if (!result.success) return PaymentSessionStatus.ERROR
        return mapMollieStatusToMedusa(result.data.status)
      }

      if (mollieOrderId) {
        const result = await client.getOrder(mollieOrderId)
        if (!result.success) return PaymentSessionStatus.ERROR
        return mapMollieStatusToMedusa(result.data.status)
      }

      return PaymentSessionStatus.PENDING
    } catch (error: any) {
      this.getLogger().error(`[Mollie] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IMolliePaymentSessionData,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getMollieClient()
      const { molliePaymentId, mollieOrderId } = paymentSessionData

      if (molliePaymentId) {
        const result = await client.getPayment(molliePaymentId)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to retrieve Mollie payment")
        }
        return {
          session_data: {
            ...paymentSessionData,
            status: result.data.status,
            method: result.data.method,
          },
          status: mapMollieStatusToMedusa(result.data.status),
        }
      }

      if (mollieOrderId) {
        const result = await client.getOrder(mollieOrderId)
        if (!result.success) {
          throw new PaymentProviderError(result.error || "Failed to retrieve Mollie order")
        }
        return {
          session_data: {
            ...paymentSessionData,
            status: result.data.status,
            method: result.data.method,
          },
          status: mapMollieStatusToMedusa(result.data.status),
        }
      }

      throw new PaymentProviderError("No Mollie payment or order ID in session data")
    } catch (error: any) {
      this.getLogger().error(`[Mollie] Retrieve failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<any> {
    return await this.retrievePayment(context.paymentSessionData, context)
  }

  /**
   * Process Mollie webhook
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: IMolliePaymentSessionData
  }> {
    try {
      const { resource, id, action } = webhookData

      if (resource === "order") {
        const client = await this.getMollieClient()
        const result = await client.getOrder(id)

        if (!result.success) {
          throw new Error(result.error)
        }

        const mollieOrder = result.data

        return {
          action: mollieOrder.status === "paid" ? "succeed" : "fail",
          data: {
            mollieOrderId: id,
            status: mollieOrder.status,
          } as IMolliePaymentSessionData,
        }
      }

      if (resource === "payment") {
        const client = await this.getMollieClient()
        const result = await client.getPayment(id)

        if (!result.success) {
          throw new Error(result.error)
        }

        const molliePayment = result.data

        return {
          action: molliePayment.status === "paid" ? "succeed" : "fail",
          data: {
            molliePaymentId: id,
            status: molliePayment.status,
          } as IMolliePaymentSessionData,
        }
      }

      return {
        action: "neutral",
        data: webhookData,
      }
    } catch (error: any) {
      this.getLogger().error(`[Mollie] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}

export default MolliePaymentProviderService
