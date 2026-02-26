// @ts-nocheck
import {
  AbstractPaymentProvider,
  PaymentProviderError,
  PaymentSessionStatus,
  PaymentProviderSessionResponse,
  RefundInput,
} from "@medusajs/framework/utils"
import { Logger } from "@medusajs/framework/types"
import { GATEWAY_CONFIG_MODULE } from "../gateway-config"
import { ComgateApiClient } from "./api-client"

export interface IComgatePaymentSessionData {
  transId?: string
  status?: string
  amount?: number
  currency?: string
  method?: string
  createdAt?: number
}

/**
 * Maps Comgate payment statuses to Medusa payment session statuses
 */
function mapComgateStatusToMedusa(comgateStatus: string): PaymentSessionStatus {
  switch (comgateStatus) {
    case "PAID":
      return PaymentSessionStatus.AUTHORIZED
    case "AUTHORIZED":
      return PaymentSessionStatus.AUTHORIZED
    case "PENDING":
      return PaymentSessionStatus.PENDING
    case "CANCELLED":
      return PaymentSessionStatus.CANCELED
    case "FAILED":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Comgate payment provider service
 * Integrates with Comgate payment redirect API for bank transfers and cards
 * Supports CZK, EUR, and other currencies
 */
export class ComgatePaymentProvider extends AbstractPaymentProvider {
  protected client_: ComgateApiClient | null = null
  protected gatewayConfigService_: any
  protected logger_: Logger

  constructor(container: any) {
    super(container)
    this.gatewayConfigService_ = container.resolve(GATEWAY_CONFIG_MODULE)
    this.logger_ = container.resolve("logger")
  }

  /**
   * Initialize the Comgate API client with credentials from gateway_config
   */
  private async getComgateClient(): Promise<ComgateApiClient> {
    if (!this.client_) {
      const configs = await this.gatewayConfigService_.listGatewayConfigs(
        { provider: "comgate", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (!config) {
        throw new PaymentProviderError("Comgate gateway not configured")
      }
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      if (!keys?.api_key || !keys?.secret_key) {
        throw new PaymentProviderError("Comgate merchant ID or secret not configured")
      }
      this.client_ = new ComgateApiClient(keys.api_key, keys.secret_key)
    }
    return this.client_
  }

  /**
   * Get identifier for the payment provider
   */
  static identifier = "comgate"

  /**
   * Initiate a payment session — create Comgate payment with redirect URL
   */
  async initiatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    const {
      amount,
      currency_code,
      customer,
      cart,
      context: contextData,
    } = context

    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")

      // Use statement descriptor if provided, otherwise use order ID
      const descriptor = (
        contextData?.statement_descriptor || `Order ${cart?.id}`
      ).substring(0, 16)

      const paymentParams = {
        merchant: config.api_key,
        price: amount, // already in cents
        curr: currency_code.toUpperCase(),
        label: descriptor,
        refId: cart?.id || `ref-${Date.now()}`,
        secret: config.secret_key,
        email: customer?.email,
        country: customer?.billing_address?.country_code?.toUpperCase(),
        prepareOnly: true, // get transId + URL without redirect
      }

      const result = await client.createPayment(paymentParams)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create payment")
      }

      if (!result.data?.transId || !result.data?.redirectUrl) {
        throw new PaymentProviderError("No payment redirect URL from Comgate")
      }

      this.logger_.info(
        `[Comgate] Payment created: transId=${result.data.transId}, redirect=${result.data.redirectUrl}`
      )

      return {
        session_data: {
          transId: result.data.transId,
          amount,
          currency: currency_code,
          createdAt: Date.now(),
        } as IComgatePaymentSessionData,
        redirect_url: result.data.redirectUrl,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Payment initiation failed: ${error.message}`)
      throw new PaymentProviderError(
        error.message || "Failed to initiate Comgate payment"
      )
    }
  }

  /**
   * Authorize payment — check Comgate payment status
   */
  async authorizePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        throw new PaymentProviderError("No Comgate transaction ID in session data")
      }

      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to check payment status")
      }

      const status = mapComgateStatusToMedusa(result.data?.status || "PENDING")

      return {
        session_data: {
          ...paymentSessionData,
          transId,
          status: result.data?.status,
          method: result.data?.method,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Authorization check failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Capture payment — Comgate auto-captures on successful payment, verify status
   */
  async capturePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        throw new PaymentProviderError("No Comgate transaction ID in session data")
      }

      // Fetch current status
      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to verify payment")
      }

      const status = mapComgateStatusToMedusa(result.data?.status || "PENDING")

      return {
        session_data: {
          ...paymentSessionData,
          transId,
          status: result.data?.status,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Capture failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IComgatePaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        throw new PaymentProviderError("No Comgate transaction ID in session data")
      }

      const result = await client.createRefund({
        merchant: config.api_key,
        transId,
        amount: refundAmount, // in cents
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create refund")
      }

      this.logger_.info(
        `[Comgate] Refund created for transId ${transId}: ${(refundAmount / 100).toFixed(2)}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Refund failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment — no direct cancel API, just mark as cancelled
   */
  async cancelPayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      this.logger_.info(
        `[Comgate] Transaction ${paymentSessionData.transId} marked for cancellation`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Cancel failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    // No-op for Comgate — cleanup handled server-side
    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentSessionStatus> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        return PaymentSessionStatus.PENDING
      }

      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        return PaymentSessionStatus.ERROR
      }

      return mapComgateStatusToMedusa(result.data?.status || "PENDING")
    } catch (error: any) {
      this.logger_.error(`[Comgate] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")
      const { transId } = paymentSessionData

      if (!transId) {
        throw new PaymentProviderError("No Comgate transaction ID in session data")
      }

      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to retrieve payment")
      }

      const status = mapComgateStatusToMedusa(result.data?.status || "PENDING")

      return {
        session_data: {
          ...paymentSessionData,
          transId,
          status: result.data?.status,
          method: result.data?.method,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Retrieve failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    return await this.retrievePayment(context.paymentSessionData, context)
  }

  /**
   * Process Comgate webhook — push notification with transId
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: IComgatePaymentSessionData
  }> {
    try {
      const { transId } = webhookData

      if (!transId) {
        return {
          action: "neutral",
          data: webhookData,
        }
      }

      const client = await this.getComgateClient()
      const config = await this.gatewayConfigService_.retrieve("comgate")

      const result = await client.getStatus({
        merchant: config.api_key,
        transId,
        secret: config.secret_key,
      })

      if (!result.success) {
        throw new Error(result.error)
      }

      const status = result.data?.status || "PENDING"

      return {
        action: status === "PAID" ? "succeed" : "fail",
        data: {
          transId,
          status,
        } as IComgatePaymentSessionData,
      }
    } catch (error: any) {
      this.logger_.error(`[Comgate] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
