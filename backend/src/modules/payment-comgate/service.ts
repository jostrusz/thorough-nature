// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { ComgateApiClient } from "./api-client"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

export interface IComgatePaymentSessionData {
  transId?: string
  status?: string
  amount?: number
  currency?: string
  method?: string
  createdAt?: number
  checkoutUrl?: string
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
  protected container_: any
  protected client_: ComgateApiClient | null = null
  protected logger_: any

  static identifier = "comgate"

  constructor(container: any, options?: any) {
    super(container, options)
    this.container_ = container
    this.logger_ = container.logger || console
  }

  private getLogger() {
    return this.logger_ || console
  }

  /**
   * Lazily resolve the gateway config service from the container.
   * Avoids issues where the gateway config module isn't available at constructor time.
   */
  private getGatewayConfigService() {
    try {
      return this.container_.resolve(GATEWAY_CONFIG_MODULE)
    } catch {
      return null
    }
  }

  /**
   * Get the active Comgate gateway config from the database.
   * Returns null if gatewayConfig module is unavailable or no config found.
   */
  private async getComgateConfig(): Promise<any> {
    const gcService = this.getGatewayConfigService()
    if (!gcService) {
      this.getLogger().warn("[Comgate] Gateway config service not available")
      return null
    }
    try {
      const configs = await gcService.listGatewayConfigs(
        { provider: "comgate", is_active: true },
        { take: 1 }
      )
      return configs[0] || null
    } catch (e: any) {
      this.getLogger().warn(`[Comgate] Gateway config read failed: ${e.message}`)
      return null
    }
  }

  /**
   * Initialize the Comgate API client with credentials from gateway_config
   */
  private async getComgateClient(): Promise<ComgateApiClient> {
    if (this.client_) return this.client_

    const config = await this.getComgateConfig()
    if (!config) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Comgate gateway not configured. Set credentials in admin gateway config."
      )
    }
    const isLive = config.mode === "live"
    const keys = isLive ? config.live_keys : config.test_keys
    if (!keys?.api_key || !keys?.secret_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Comgate merchant ID or secret not configured"
      )
    }
    this.client_ = new ComgateApiClient(keys.api_key, keys.secret_key)
    return this.client_
  }

  /**
   * Get keys from config for status/refund calls
   */
  private getKeysFromConfig(config: any): { api_key: string; secret_key: string } | null {
    if (!config) return null
    const isLive = config.mode === "live"
    const keys = isLive ? config.live_keys : config.test_keys
    return keys?.api_key && keys?.secret_key ? keys : null
  }

  /**
   * Initiate a payment session — create Comgate payment with redirect URL
   */
  async initiatePayment(context: any): Promise<any> {
    const {
      amount,
      currency_code,
      customer,
      cart,
      context: contextData,
    } = context

    try {
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()

      // Use statement descriptor if provided, otherwise use order ID
      const descriptor = (
        contextData?.statement_descriptor || `Order ${cart?.id}`
      ).substring(0, 16)

      const paymentParams = {
        merchant: config?.live_keys?.api_key || config?.test_keys?.api_key,
        price: amount, // already in cents
        curr: currency_code.toUpperCase(),
        label: descriptor,
        refId: cart?.id || `ref-${Date.now()}`,
        secret: config?.live_keys?.secret_key || config?.test_keys?.secret_key,
        email: customer?.email,
        country: customer?.billing_address?.country_code?.toUpperCase(),
        prepareOnly: true, // get transId + URL without redirect
        method: contextData?.comgate_method || undefined, // Pre-select method on Comgate page
      }

      const result = await client.createPayment(paymentParams)
      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to create payment"
        )
      }

      if (!result.data?.transId || !result.data?.redirectUrl) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "No payment redirect URL from Comgate"
        )
      }

      this.getLogger().info(
        `[Comgate] Payment created: transId=${result.data.transId}, redirect=${result.data.redirectUrl}`
      )

      return {
        session_data: {
          transId: result.data.transId,
          amount,
          currency: currency_code,
          createdAt: Date.now(),
          checkoutUrl: result.data.redirectUrl, // frontend reads providerData.checkoutUrl
        } as IComgatePaymentSessionData,
        redirect_url: result.data.redirectUrl,
      }
    } catch (error: any) {
      this.getLogger().error(`[Comgate] Payment initiation failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
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
  ): Promise<any> {
    try {
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const { transId } = paymentSessionData

      if (!transId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Comgate transaction ID in session data"
        )
      }

      const result = await client.getStatus({
        merchant: keys?.api_key,
        transId,
        secret: keys?.secret_key,
      })

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to check payment status"
        )
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
      this.getLogger().error(`[Comgate] Authorization check failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Capture payment — Comgate auto-captures on successful payment, verify status
   */
  async capturePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const { transId } = paymentSessionData

      if (!transId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Comgate transaction ID in session data"
        )
      }

      // Fetch current status
      const result = await client.getStatus({
        merchant: keys?.api_key,
        transId,
        secret: keys?.secret_key,
      })

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to verify payment"
        )
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
      this.getLogger().error(`[Comgate] Capture failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IComgatePaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const { transId } = paymentSessionData

      if (!transId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Comgate transaction ID in session data"
        )
      }

      const result = await client.createRefund({
        merchant: keys?.api_key,
        transId,
        amount: refundAmount, // in cents
        secret: keys?.secret_key,
      })

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to create refund"
        )
      }

      this.getLogger().info(
        `[Comgate] Refund created for transId ${transId}: ${(refundAmount / 100).toFixed(2)}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Comgate] Refund failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Cancel payment — no direct cancel API, just mark as cancelled
   */
  async cancelPayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<any> {
    this.getLogger().info(
      `[Comgate] Transaction ${paymentSessionData.transId} marked for cancellation`
    )

    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<any> {
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
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const { transId } = paymentSessionData

      if (!transId) {
        return PaymentSessionStatus.PENDING
      }

      const result = await client.getStatus({
        merchant: keys?.api_key,
        transId,
        secret: keys?.secret_key,
      })

      if (!result.success) {
        return PaymentSessionStatus.ERROR
      }

      return mapComgateStatusToMedusa(result.data?.status || "PENDING")
    } catch (error: any) {
      this.getLogger().error(`[Comgate] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IComgatePaymentSessionData,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const { transId } = paymentSessionData

      if (!transId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Comgate transaction ID in session data"
        )
      }

      const result = await client.getStatus({
        merchant: keys?.api_key,
        transId,
        secret: keys?.secret_key,
      })

      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to retrieve payment"
        )
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
      this.getLogger().error(`[Comgate] Retrieve failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<any> {
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
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)

      const result = await client.getStatus({
        merchant: keys?.api_key,
        transId,
        secret: keys?.secret_key,
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
      this.getLogger().error(`[Comgate] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
