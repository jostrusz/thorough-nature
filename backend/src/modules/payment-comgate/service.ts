// @ts-nocheck
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import { ComgateApiClient } from "./api-client"
import { Client } from "pg"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

/**
 * Shared config cache — survives across method calls, cleared after 5 min.
 * Avoids opening a new DB connection on every request.
 */
let _comgateConfigCache: any = null
let _comgateConfigCacheTime = 0
const CONFIG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

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
   * Uses a 3-level fallback strategy because payment providers run in a scoped
   * container that may not have access to custom standalone modules:
   *   1. gatewayConfig module service (ideal, may not resolve)
   *   2. __pg_connection__ Knex instance (shared resource, may not resolve)
   *   3. Raw pg Client via DATABASE_URL (always works, independent of container)
   * Results are cached for 5 minutes to avoid repeated DB connections.
   */
  private async getComgateConfig(): Promise<any> {
    // Return cached config if fresh
    if (_comgateConfigCache && (Date.now() - _comgateConfigCacheTime) < CONFIG_CACHE_TTL) {
      return _comgateConfigCache
    }

    // Method 1: Try gateway config module service
    const gcService = this.getGatewayConfigService()
    if (gcService) {
      try {
        const configs = await gcService.listGatewayConfigs(
          { provider: "comgate", is_active: true },
          { take: 1 }
        )
        if (configs[0]) {
          this.getLogger().info("[Comgate] Config loaded via gatewayConfig module")
          _comgateConfigCache = configs[0]
          _comgateConfigCacheTime = Date.now()
          return configs[0]
        }
      } catch (e: any) {
        this.getLogger().warn(`[Comgate] Gateway config module query failed: ${e.message}`)
      }
    }

    // Method 2: Direct DB query via Knex (__pg_connection__)
    try {
      const knex = this.container_.resolve("__pg_connection__")
      const rows = await knex("gateway_config")
        .where({ provider: "comgate", is_active: true })
        .whereNull("deleted_at")
        .limit(1)

      if (rows && rows[0]) {
        this.getLogger().info("[Comgate] Config loaded via __pg_connection__")
        _comgateConfigCache = rows[0]
        _comgateConfigCacheTime = Date.now()
        return rows[0]
      }
    } catch (e: any) {
      this.getLogger().warn(`[Comgate] __pg_connection__ query failed: ${e.message}`)
    }

    // Method 3: Raw pg Client via DATABASE_URL (ultimate fallback)
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
          ["comgate"]
        )
        if (result.rows[0]) {
          this.getLogger().info("[Comgate] Config loaded via raw pg (DATABASE_URL)")
          _comgateConfigCache = result.rows[0]
          _comgateConfigCacheTime = Date.now()
          return result.rows[0]
        }
      } catch (e: any) {
        this.getLogger().warn(`[Comgate] Raw pg query failed: ${e.message}`)
      } finally {
        if (pgClient) {
          try { await pgClient.end() } catch {}
        }
      }
    }

    this.getLogger().warn("[Comgate] No gateway config found via any method")
    return null
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

    // Debug: log config structure to identify key mapping issues
    this.getLogger().info(`[Comgate] Config mode=${config.mode}, isLive=${isLive}, ` +
      `live_keys type=${typeof config.live_keys}, test_keys type=${typeof config.test_keys}, ` +
      `keys type=${typeof keys}, keys keys=${keys ? Object.keys(keys).join(',') : 'null'}, ` +
      `has api_key=${!!keys?.api_key}, has secret_key=${!!keys?.secret_key}`)

    // If keys is a string (raw pg might not auto-parse json), try to parse it
    let parsedKeys = keys
    if (typeof keys === 'string') {
      try { parsedKeys = JSON.parse(keys) } catch {}
    }

    if (!parsedKeys?.api_key || !parsedKeys?.secret_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Comgate merchant ID or secret not configured"
      )
    }
    this.client_ = new ComgateApiClient(parsedKeys.api_key, parsedKeys.secret_key)
    return this.client_
  }

  /**
   * Get keys from config for status/refund calls.
   * Handles both parsed objects and JSON strings (raw pg fallback).
   */
  private getKeysFromConfig(config: any): { api_key: string; secret_key: string } | null {
    if (!config) return null
    const isLive = config.mode === "live"
    let keys = isLive ? config.live_keys : config.test_keys
    if (typeof keys === 'string') {
      try { keys = JSON.parse(keys) } catch { return null }
    }
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
      // In Medusa v2, frontend session data lives in context.data (not context.context)
      // context.context only has { idempotency_key }
      const sessionData = context?.data || {}

      // Debug: log what arrives in initiatePayment so we can trace method flow
      this.getLogger().info(`[Comgate] initiatePayment input keys: ${Object.keys(context || {}).join(", ")}`)
      this.getLogger().info(`[Comgate] sessionData (context.data) keys: ${Object.keys(sessionData).join(", ")}`)
      this.getLogger().info(`[Comgate] sessionData.comgate_method=${sessionData?.comgate_method}, sessionData.method=${sessionData?.method}`)

      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()

      // Use statement descriptor if provided, otherwise use refId or generic label
      const refId = sessionData?.refId || contextData?.refId || cart?.id || `ref-${Date.now()}`
      const descriptor = (
        contextData?.statement_descriptor || sessionData?.label || "Zamowienie"
      ).substring(0, 16)

      // Comgate expects price in haléře (cents). Medusa stores CZK amounts as
      // integer koruny (e.g. 550 for 550 Kč), so we multiply by 100 to get
      // haléře (55000 = 550.00 Kč). Same applies to EUR (cents).
      const priceInCents = Math.round(amount * 100)

      // Email: primary source is sessionData (context.data) from frontend checkout form
      const customerEmail = sessionData?.email || contextData?.email || customer?.email || ""

      // Customer name from frontend addresses (for Comgate admin)
      const addr = sessionData?.billing_address || sessionData?.shipping_address || {}
      const customerName = ((addr.first_name || "") + " " + (addr.last_name || "")).trim()
        || ((customer?.first_name || "") + " " + (customer?.last_name || "")).trim()

      // Determine language based on currency/country
      const curr = currency_code.toUpperCase()
      const billingCountry = (sessionData?.billing_address?.country_code || customer?.billing_address?.country_code || "").toUpperCase()
      let lang = "en"
      if (curr === "PLN" || billingCountry === "PL") lang = "pl"
      else if (curr === "CZK" || billingCountry === "CZ") lang = "cs"
      else if (curr === "EUR" && billingCountry === "SK") lang = "sk"

      // Determine country fallback based on currency
      let countryFallback = "ALL"
      if (curr === "PLN") countryFallback = "PL"
      else if (curr === "CZK") countryFallback = "CZ"

      // Map frontend method codes to Comgate method codes
      // Priority: comgate_method (already mapped by frontend) > method (raw frontend code)
      const rawMethod = sessionData?.comgate_method || sessionData?.method || contextData?.comgate_method || "ALL"
      let comgateMethod = "ALL"

      // Legacy → PSD2 upgrade map (old Comgate codes that no longer exist)
      const LEGACY_TO_PSD2: Record<string, string> = {
        "BANK_CZ_CS_P": "BANK_CZ_CS_PSD2",
        "BANK_CZ_CSOB_P": "BANK_CZ_CSOB_PSD2",
        "BANK_CZ_KB": "BANK_CZ_KB_PSD2",
        "BANK_CZ_RB": "BANK_CZ_RB_PSD2",
        "BANK_CZ_GE": "BANK_CZ_MO_PSD2",
        "BANK_CZ_FB": "BANK_CZ_FB_PSD2",
        "BANK_CZ_MB_P": "BANK_CZ_MB_PSD2",
        "BANK_CZ_AB": "BANK_CZ_AB_PSD2",
        "BANK_ALL": "BANK_CZ_OTHER",
      }

      // If it already looks like a Comgate code (uppercase with underscores/digits), pass through
      if (/^[A-Z0-9_]+$/.test(rawMethod) && rawMethod !== "ALL") {
        // Upgrade legacy codes to PSD2 if needed
        comgateMethod = LEGACY_TO_PSD2[rawMethod] || rawMethod
      }
      // Map legacy frontend codes
      else if (rawMethod === "blik" || rawMethod === "blik_pl") comgateMethod = "BANK_PL_BL"
      else if (rawMethod === "bank_transfer") comgateMethod = "BANK_CZ_OTHER"
      else if (rawMethod === "creditcard" || rawMethod === "card") comgateMethod = "CARD_CZ_COMGATE"
      else if (rawMethod.startsWith("bank_pl_")) comgateMethod = rawMethod.toUpperCase()
      else if (rawMethod.startsWith("bank_cz_")) comgateMethod = LEGACY_TO_PSD2[rawMethod.toUpperCase()] || rawMethod.toUpperCase()
      else if (rawMethod === "przelew_bankowy") comgateMethod = "BANK_CZ_OTHER"
      else if (rawMethod === "ALL" || !rawMethod) comgateMethod = "ALL"
      else comgateMethod = rawMethod.toUpperCase()

      this.getLogger().info(`[Comgate] Method mapping: rawMethod=${rawMethod} → comgateMethod=${comgateMethod}`)

      // Build return URLs for Comgate redirect after payment
      // Frontend sends return_url in session data (e.g. "https://psi-superzivot.cz/p/psi-superzivot/checkout?payment_return=1&cart_id=xxx")
      const returnUrl = sessionData?.return_url || contextData?.return_url || ""
      // For cancelled/pending, append comgate_status so frontend can show appropriate UI
      const cancelUrl = returnUrl ? returnUrl + (returnUrl.includes("?") ? "&" : "?") + "comgate_status=cancelled" : ""
      const pendingUrl = returnUrl ? returnUrl + (returnUrl.includes("?") ? "&" : "?") + "comgate_status=pending" : ""

      const paymentParams = {
        merchant: config?.live_keys?.api_key || config?.test_keys?.api_key,
        price: priceInCents,
        curr: curr,
        label: descriptor,
        refId: refId,
        secret: config?.live_keys?.secret_key || config?.test_keys?.secret_key,
        email: customerEmail,
        name: customerName || undefined, // payer name (shown in Comgate admin)
        lang,
        country: billingCountry || countryFallback,
        prepareOnly: true, // get transId + URL without redirect
        method: comgateMethod,
        url_ok: returnUrl || undefined,
        url_cancel: cancelUrl || undefined,
        url_pending: pendingUrl || undefined,
      }

      this.getLogger().info(`[Comgate] Creating payment: merchant=${paymentParams.merchant}, ` +
        `price=${paymentParams.price} (original amount=${amount}, *100), curr=${paymentParams.curr}, ` +
        `email=${paymentParams.email}, refId=${paymentParams.refId}, method=${paymentParams.method}`)

      const result = await client.createPayment(paymentParams)

      if (!result.success) {
        this.getLogger().error(`[Comgate] Payment creation failed: ${result.error}, ` +
          `code=${result.data?.code}, message=${result.data?.message}`)
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          result.error || "Failed to create payment"
        )
      }

      if (!result.data?.transId || !result.data?.redirectUrl) {
        this.getLogger().error(`[Comgate] Missing transId or redirectUrl in response: ` +
          `transId=${result.data?.transId}, redirectUrl=${result.data?.redirectUrl}`)
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "No payment redirect URL from Comgate"
        )
      }

      this.getLogger().info(
        `[Comgate] Payment created: transId=${result.data.transId}, redirect=${result.data.redirectUrl}`
      )

      // Return format required by Medusa v2: { data: { ... } }
      // Frontend reads lastSession.data.checkoutUrl for redirect
      return {
        data: {
          transId: result.data.transId,
          amount,
          currency: currency_code,
          createdAt: Date.now(),
          checkoutUrl: result.data.redirectUrl,
        },
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
   * Medusa v2: receives AuthorizePaymentInput { data, context, ... }
   */
  async authorizePayment(input: any): Promise<any> {
    try {
      // Medusa v2: session data is in input.data (not the input itself)
      const paymentSessionData = input?.data || input
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const transId = paymentSessionData?.transId

      this.getLogger().info(`[Comgate] authorizePayment: input keys=${Object.keys(input || {}).join(",")}, transId=${transId}`)

      if (!transId) {
        this.getLogger().error(`[Comgate] authorizePayment: No transId found. input.data=${JSON.stringify(paymentSessionData).substring(0, 200)}`)
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

      // Use the method from Comgate API response, but also preserve the original
      // frontend-selected method (comgate_method) for accurate icon/label display
      const comgateApiMethod = result.data?.method || ""
      const frontendMethod = paymentSessionData?.comgate_method || paymentSessionData?.method || ""

      return {
        data: {
          ...paymentSessionData,
          transId,
          status: result.data?.status,
          method: frontendMethod || comgateApiMethod,
          comgate_api_method: comgateApiMethod,
          comgateTransId: transId,
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
   * Medusa v2: receives CapturePaymentInput { data, ... }
   */
  async capturePayment(input: any): Promise<any> {
    try {
      const paymentSessionData = input?.data || input
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const transId = paymentSessionData?.transId

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
        data: {
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
   * Medusa v2: receives RefundPaymentInput { data, amount, ... }
   */
  async refundPayment(input: any): Promise<any> {
    try {
      const paymentSessionData = input?.data || input
      const refundAmount = input?.amount || 0
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const transId = paymentSessionData?.transId

      if (!transId) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "No Comgate transaction ID in session data"
        )
      }

      // Convert refund amount to haléře (same as createPayment)
      const refundInCents = Math.round(refundAmount * 100)

      const result = await client.createRefund({
        merchant: keys?.api_key,
        transId,
        amount: refundInCents,
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
        data: paymentSessionData,
        status: PaymentSessionStatus.AUTHORIZED,
      }
    } catch (error: any) {
      this.getLogger().error(`[Comgate] Refund failed: ${error.message}`)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, error.message)
    }
  }

  /**
   * Cancel payment — no direct cancel API, just mark as cancelled
   * Medusa v2: receives CancelPaymentInput { data, ... }
   */
  async cancelPayment(input: any): Promise<any> {
    const paymentSessionData = input?.data || input
    this.getLogger().info(
      `[Comgate] Transaction ${paymentSessionData?.transId} marked for cancellation`
    )

    return {
      data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Delete payment session
   * Medusa v2: receives DeletePaymentInput { data, ... }
   */
  async deletePayment(input: any): Promise<any> {
    const paymentSessionData = input?.data || input
    // No-op for Comgate — cleanup handled server-side
    return {
      data: paymentSessionData,
      status: PaymentSessionStatus.CANCELED,
    }
  }

  /**
   * Get payment status
   * Medusa v2: receives RetrievePaymentInput { data, ... }
   */
  async getPaymentStatus(input: any): Promise<PaymentSessionStatus> {
    try {
      const paymentSessionData = input?.data || input
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const transId = paymentSessionData?.transId

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
   * Medusa v2: receives RetrievePaymentInput { data, ... }
   */
  async retrievePayment(input: any): Promise<any> {
    try {
      const paymentSessionData = input?.data || input
      const client = await this.getComgateClient()
      const config = await this.getComgateConfig()
      const keys = this.getKeysFromConfig(config)
      const transId = paymentSessionData?.transId

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
        data: {
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
   * Medusa v2: receives UpdatePaymentInput { data, ... }
   */
  async updatePayment(input: any): Promise<any> {
    return await this.retrievePayment(input)
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
