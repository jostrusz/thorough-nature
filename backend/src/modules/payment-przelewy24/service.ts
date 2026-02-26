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
import { Przelewy24ApiClient } from "./api-client"
import crypto from "crypto"

export interface IP24PaymentSessionData {
  token?: string
  sessionId?: string
  orderId?: string
  amount?: number
  currency?: string
  status?: string
  createdAt?: number
}

/**
 * Maps Przelewy24 payment statuses to Medusa payment session statuses
 */
function mapP24StatusToMedusa(p24Status: string): PaymentSessionStatus {
  switch (p24Status) {
    case "completed":
    case "success":
    case "authorized":
      return PaymentSessionStatus.AUTHORIZED
    case "pending":
    case "waiting":
      return PaymentSessionStatus.PENDING
    case "cancelled":
    case "expired":
      return PaymentSessionStatus.CANCELED
    case "rejected":
    case "error":
    case "failed":
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

/**
 * Przelewy24 payment provider service
 * Integrates with Przelewy24 REST API for Polish payments (BLIK, bank transfers, cards)
 * Supports PLN, EUR and other currencies
 * Flow: register transaction → redirect → customer pays → webhook verification
 */
export class Przelewy24PaymentProvider extends AbstractPaymentProvider {
  protected client_: Przelewy24ApiClient | null = null
  protected gatewayConfigService_: any
  protected logger_: Logger

  constructor(container: any) {
    super(container)
    this.gatewayConfigService_ = container.resolve(GATEWAY_CONFIG_MODULE)
    this.logger_ = container.resolve("logger")
  }

  /**
   * Initialize the P24 API client with credentials from gateway_config
   */
  private async getP24Client(): Promise<Przelewy24ApiClient> {
    if (!this.client_) {
      const configs = await this.gatewayConfigService_.listGatewayConfigs(
        { provider: "przelewy24", is_active: true },
        { take: 1 }
      )
      const config = configs[0]
      if (!config) {
        throw new PaymentProviderError("Przelewy24 gateway not configured")
      }
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      const meta = config.metadata || {}
      if (!keys?.api_key || !keys?.secret_key) {
        throw new PaymentProviderError(
          "Przelewy24 credentials not configured (need merchantId, api_key, CRC, and pos_id in metadata)"
        )
      }

      const merchantId = keys.api_key
      const posId = meta.pos_id || keys.api_key
      const apiKey = keys.secret_key
      const crc = meta.crc || ""
      const testMode = !isLive

      this.client_ = new Przelewy24ApiClient(
        merchantId,
        posId,
        apiKey,
        crc,
        testMode
      )
    }
    return this.client_
  }

  /**
   * Get identifier for the payment provider
   */
  static identifier = "przelewy24"

  /**
   * Initiate a payment session — register transaction with P24
   */
  async initiatePayment(context: any): Promise<PaymentProviderSessionResponse> {
    const { amount, currency_code, customer, cart, context: contextData } =
      context

    try {
      const client = await this.getP24Client()
      const config = await this.gatewayConfigService_.retrieve("przelewy24")

      const sessionId = cart?.id || `sess-${Date.now()}`
      const merchantId = config.api_key
      const posId = config.gateway_metadata.pos_id

      const registerParams = {
        merchantId,
        posId,
        sessionId,
        amount, // already in grosze
        currency: currency_code.toUpperCase(),
        description: contextData?.statement_descriptor || `Order ${sessionId}`,
        email: customer?.email || "customer@example.com",
        country: customer?.billing_address?.country_code?.toUpperCase() || "PL",
        urlReturn: `${contextData?.return_url || "https://example.com"}/payment/success`,
        urlStatus: `${contextData?.webhook_url || "https://api.example.com"}/webhooks/przelewy24`,
        crc: config.api_key_2 || "",
      }

      const result = await client.registerTransaction(registerParams)
      if (!result.success) {
        throw new PaymentProviderError(
          result.error || "Failed to register P24 transaction"
        )
      }

      if (!result.data?.transactionUrl) {
        throw new PaymentProviderError("No transaction URL returned from P24")
      }

      this.logger_.info(
        `[Przelewy24] Transaction registered: sessionId=${sessionId}, redirect=${result.data.transactionUrl}`
      )

      return {
        session_data: {
          token: result.data.token,
          sessionId,
          amount,
          currency: currency_code,
          createdAt: Date.now(),
        } as IP24PaymentSessionData,
        redirect_url: result.data.transactionUrl,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Payment initiation failed: ${error.message}`)
      throw new PaymentProviderError(
        error.message || "Failed to initiate Przelewy24 payment"
      )
    }
  }

  /**
   * Authorize payment — verify with P24 after webhook
   */
  async authorizePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getP24Client()
      const config = await this.gatewayConfigService_.retrieve("przelewy24")
      const { sessionId, orderId, amount, currency } = paymentSessionData

      if (!sessionId || !orderId) {
        throw new PaymentProviderError(
          "Missing sessionId or orderId in session data"
        )
      }

      const verifyParams = {
        merchantId: config.api_key,
        posId: config.gateway_metadata.pos_id,
        sessionId,
        orderId,
        amount,
        currency,
        crc: config.api_key_2 || "",
      }

      const result = await client.verifyTransaction(verifyParams)
      if (!result.success) {
        throw new PaymentProviderError(
          result.error || "Failed to verify P24 transaction"
        )
      }

      const status = mapP24StatusToMedusa(
        result.data?.status || "pending"
      )

      return {
        session_data: {
          ...paymentSessionData,
          status: result.data?.status,
        },
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Authorization check failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Capture payment — P24 captures immediately after payment
   */
  async capturePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      // P24 auto-captures on successful payment
      // Return current status
      const status = mapP24StatusToMedusa(
        paymentSessionData.status || "pending"
      )

      return {
        session_data: paymentSessionData,
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Capture failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IP24PaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const client = await this.getP24Client()
      const config = await this.gatewayConfigService_.retrieve("przelewy24")
      const { sessionId, orderId } = paymentSessionData

      if (!orderId || !sessionId) {
        throw new PaymentProviderError("Missing orderId or sessionId for refund")
      }

      const requestId = `refund-${Date.now()}`

      const refundParams = {
        requestId,
        refunds: [
          {
            orderId,
            sessionId,
            amount: refundAmount,
            description: `Refund ${(refundAmount / 100).toFixed(2)}`,
          },
        ],
        urlStatus: `${config.gateway_metadata?.webhook_url || "https://api.example.com"}/webhooks/przelewy24`,
      }

      const result = await client.createRefund(refundParams)
      if (!result.success) {
        throw new PaymentProviderError(result.error || "Failed to create refund")
      }

      this.logger_.info(
        `[Przelewy24] Refund created for orderId ${orderId}: ${(refundAmount / 100).toFixed(2)}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Refund failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      this.logger_.info(
        `[Przelewy24] Transaction ${paymentSessionData.sessionId} marked for cancellation`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.CANCELED,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Cancel failed: ${error.message}`)
      throw new PaymentProviderError(error.message)
    }
  }

  /**
   * Delete payment session
   */
  async deletePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    // No-op for P24 — cleanup handled server-side
    return {
      session_data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   */
  async getPaymentStatus(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentSessionStatus> {
    try {
      const status = paymentSessionData.status || "pending"
      return mapP24StatusToMedusa(status)
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<PaymentProviderSessionResponse> {
    try {
      const status = mapP24StatusToMedusa(
        paymentSessionData.status || "pending"
      )

      return {
        session_data: paymentSessionData,
        status,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Retrieve failed: ${error.message}`)
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
   * Process Przelewy24 webhook
   * P24 sends POST with: merchantId, posId, sessionId, orderId, amount, currency, sign
   * MUST verify sign before processing
   */
  async getWebhookActionAndData(webhookData: any): Promise<{
    action: string
    data: IP24PaymentSessionData
  }> {
    try {
      const {
        merchantId,
        posId,
        sessionId,
        orderId,
        amount,
        currency,
        sign,
      } = webhookData

      if (!sessionId || !orderId) {
        return {
          action: "neutral",
          data: webhookData,
        }
      }

      const config = await this.gatewayConfigService_.retrieve("przelewy24")

      // Verify signature: sign should be SHA384 of sessionId|orderId|amount|currency|crc
      const expectedSign = crypto
        .createHash("sha384")
        .update(
          `${sessionId}|${orderId}|${amount}|${currency}|${config.api_key_2 || ""}`
        )
        .digest("hex")

      if (sign !== expectedSign) {
        this.logger_.warn(
          `[Przelewy24] Invalid webhook signature for sessionId ${sessionId}`
        )
        return {
          action: "fail",
          data: webhookData,
        }
      }

      const client = await this.getP24Client()

      const verifyParams = {
        merchantId: config.api_key,
        posId,
        sessionId,
        orderId,
        amount,
        currency,
        crc: config.api_key_2 || "",
      }

      const result = await client.verifyTransaction(verifyParams)

      if (!result.success) {
        this.logger_.warn(
          `[Przelewy24] Verification failed for orderId ${orderId}: ${result.error}`
        )
        return {
          action: "fail",
          data: webhookData,
        }
      }

      const status = result.data?.status || "pending"

      return {
        action: status === "completed" ? "succeed" : "fail",
        data: {
          sessionId,
          orderId,
          amount,
          currency,
          status,
        } as IP24PaymentSessionData,
      }
    } catch (error: any) {
      this.logger_.error(`[Przelewy24] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
