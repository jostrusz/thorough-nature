// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { Przelewy24ApiClient } from "./api-client"
import crypto from "crypto"
import { Client } from "pg"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

let _p24ConfigCache: any = null
let _p24ConfigCacheTime = 0
const CONFIG_CACHE_TTL = 5 * 60 * 1000

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
  protected container_: any
  protected client_: Przelewy24ApiClient | null = null
  protected logger_: any

  static identifier = "przelewy24"

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
   */
  private getGatewayConfigService() {
    try {
      return this.container_.resolve(GATEWAY_CONFIG_MODULE)
    } catch {
      return null
    }
  }

  /**
   * Get the active P24 gateway config from the database.
   * Uses a 3-level fallback strategy (same as Comgate):
   *   1. gatewayConfig module service
   *   2. __pg_connection__ Knex instance
   *   3. Raw pg Client via DATABASE_URL
   */
  private async getP24Config(): Promise<any> {
    if (_p24ConfigCache && (Date.now() - _p24ConfigCacheTime) < CONFIG_CACHE_TTL) {
      return _p24ConfigCache
    }

    // Method 1: Try gateway config module service
    const gcService = this.getGatewayConfigService()
    if (gcService) {
      try {
        const configs = await gcService.listGatewayConfigs(
          { provider: "przelewy24", is_active: true },
          { take: 1 }
        )
        if (configs[0]) {
          this.getLogger().info("[Przelewy24] Config loaded via gatewayConfig module")
          _p24ConfigCache = configs[0]
          _p24ConfigCacheTime = Date.now()
          return configs[0]
        }
      } catch (e: any) {
        this.getLogger().warn(`[Przelewy24] Gateway config module query failed: ${e.message}`)
      }
    }

    // Method 2: Direct DB query via Knex (__pg_connection__)
    try {
      const knex = this.container_.resolve("__pg_connection__")
      const rows = await knex("gateway_config")
        .where({ provider: "przelewy24", is_active: true })
        .whereNull("deleted_at")
        .limit(1)

      if (rows && rows[0]) {
        this.getLogger().info("[Przelewy24] Config loaded via __pg_connection__")
        _p24ConfigCache = rows[0]
        _p24ConfigCacheTime = Date.now()
        return rows[0]
      }
    } catch (e: any) {
      this.getLogger().warn(`[Przelewy24] __pg_connection__ query failed: ${e.message}`)
    }

    // Method 3: Raw pg Client via DATABASE_URL
    const dbUrl = process.env.DATABASE_URL
    if (dbUrl) {
      let pgClient: Client | null = null
      try {
        pgClient = new Client({
          connectionString: dbUrl,
          ssl: dbUrl.includes("railway") ? { rejectUnauthorized: false } : undefined,
        })
        await pgClient.connect()
        const result = await pgClient.query(
          "SELECT * FROM gateway_config WHERE provider = $1 AND is_active = true AND deleted_at IS NULL LIMIT 1",
          ["przelewy24"]
        )
        if (result.rows[0]) {
          this.getLogger().info("[Przelewy24] Config loaded via raw pg (DATABASE_URL)")
          _p24ConfigCache = result.rows[0]
          _p24ConfigCacheTime = Date.now()
          return result.rows[0]
        }
      } catch (e: any) {
        this.getLogger().warn(`[Przelewy24] Raw pg query failed: ${e.message}`)
      } finally {
        if (pgClient) {
          try { await pgClient.end() } catch {}
        }
      }
    }

    this.getLogger().warn("[Przelewy24] No gateway config found via any method")
    return null
  }

  /**
   * Initialize the P24 API client with credentials from gateway_config
   */
  private async getP24Client(): Promise<Przelewy24ApiClient> {
    if (this.client_) return this.client_

    const config = await this.getP24Config()
    if (!config) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Przelewy24 gateway not configured. Set credentials in admin gateway config."
      )
    }
    const isLive = config.mode === "live"
    let keys = isLive ? config.live_keys : config.test_keys
    let meta = config.metadata || {}
    // Handle JSON strings from raw pg fallback
    if (typeof keys === 'string') { try { keys = JSON.parse(keys) } catch {} }
    if (typeof meta === 'string') { try { meta = JSON.parse(meta) } catch {} }
    if (!keys?.api_key || !keys?.secret_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
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
    return this.client_
  }

  /**
   * Initiate a payment session — register transaction with P24
   */
  async initiatePayment(context: any): Promise<any> {
    const { amount, currency_code, customer, cart, context: contextData } =
      context

    try {
      const client = await this.getP24Client()
      const config = await this.getP24Config()
      const keys = config?.mode === "live" ? config.live_keys : config.test_keys
      const meta = config?.metadata || {}

      const sessionId = cart?.id || `sess-${Date.now()}`
      const merchantId = keys?.api_key
      const posId = meta.pos_id || keys?.api_key

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
        crc: meta.crc || "",
      }

      const result = await client.registerTransaction(registerParams)
      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to register P24 transaction"
        )
      }

      if (!result.data?.transactionUrl) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "No transaction URL returned from P24"
        )
      }

      this.getLogger().info(
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
      this.getLogger().error(`[Przelewy24] Payment initiation failed: ${error.message}`)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
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
  ): Promise<any> {
    try {
      const client = await this.getP24Client()
      const config = await this.getP24Config()
      const keys = config?.mode === "live" ? config.live_keys : config.test_keys
      const meta = config?.metadata || {}
      const { sessionId, orderId, amount, currency } = paymentSessionData

      if (!sessionId || !orderId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Missing sessionId or orderId in session data"
        )
      }

      const verifyParams = {
        merchantId: keys?.api_key,
        posId: meta.pos_id || keys?.api_key,
        sessionId,
        orderId,
        amount,
        currency,
        crc: meta.crc || "",
      }

      const result = await client.verifyTransaction(verifyParams)
      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
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
      this.getLogger().error(`[Przelewy24] Authorization check failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Capture payment — P24 captures immediately after payment
   */
  async capturePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<any> {
    // P24 auto-captures on successful payment
    const status = mapP24StatusToMedusa(
      paymentSessionData.status || "pending"
    )

    return {
      session_data: paymentSessionData,
      status,
    }
  }

  /**
   * Refund payment
   */
  async refundPayment(
    paymentSessionData: IP24PaymentSessionData,
    refundAmount: number,
    context: any
  ): Promise<any> {
    try {
      const client = await this.getP24Client()
      const config = await this.getP24Config()
      const meta = config?.metadata || {}
      const { sessionId, orderId } = paymentSessionData

      if (!orderId || !sessionId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Missing orderId or sessionId for refund"
        )
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
        urlStatus: `${meta?.webhook_url || "https://api.example.com"}/webhooks/przelewy24`,
      }

      const result = await client.createRefund(refundParams)
      if (!result.success) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to create refund"
        )
      }

      this.getLogger().info(
        `[Przelewy24] Refund created for orderId ${orderId}: ${(refundAmount / 100).toFixed(2)}`
      )

      return {
        session_data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Przelewy24] Refund failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<any> {
    this.getLogger().info(
      `[Przelewy24] Transaction ${paymentSessionData.sessionId} marked for cancellation`
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
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<any> {
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
      this.getLogger().error(`[Przelewy24] Status check failed: ${error.message}`)
      return PaymentSessionStatus.ERROR
    }
  }

  /**
   * Retrieve payment data
   */
  async retrievePayment(
    paymentSessionData: IP24PaymentSessionData,
    context: any
  ): Promise<any> {
    const status = mapP24StatusToMedusa(
      paymentSessionData.status || "pending"
    )

    return {
      session_data: paymentSessionData,
      status,
    }
  }

  /**
   * Update payment session
   */
  async updatePayment(context: any): Promise<any> {
    return await this.retrievePayment(context.paymentSessionData, context)
  }

  /**
   * Process Przelewy24 webhook
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

      const config = await this.getP24Config()
      const keys = config?.mode === "live" ? config.live_keys : config.test_keys
      const meta = config?.metadata || {}

      // Verify signature: sign should be SHA384 of sessionId|orderId|amount|currency|crc
      const expectedSign = crypto
        .createHash("sha384")
        .update(
          `${sessionId}|${orderId}|${amount}|${currency}|${meta.crc || ""}`
        )
        .digest("hex")

      if (sign !== expectedSign) {
        this.getLogger().warn(
          `[Przelewy24] Invalid webhook signature for sessionId ${sessionId}`
        )
        return {
          action: "fail",
          data: webhookData,
        }
      }

      const client = await this.getP24Client()

      const verifyParams = {
        merchantId: keys?.api_key,
        posId,
        sessionId,
        orderId,
        amount,
        currency,
        crc: meta.crc || "",
      }

      const result = await client.verifyTransaction(verifyParams)

      if (!result.success) {
        this.getLogger().warn(
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
      this.getLogger().error(`[Przelewy24] Webhook processing failed: ${error.message}`)
      return {
        action: "fail",
        data: webhookData,
      }
    }
  }
}
