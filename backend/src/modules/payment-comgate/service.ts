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
let _comgateConfigCache: any = null // array of all active comgate configs
let _comgateConfigCacheTime = 0
const CONFIG_CACHE_TTL = 5 * 60 * 1000 // 5 minutes
// Per-config client cache (multi-tenant: CZ + SK merchants side by side)
const _comgateClientCache = new Map<string, ComgateApiClient>()

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
      return PaymentSessionStatus.CAPTURED
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
   * Uses a 2-level fallback strategy because payment providers run in a scoped
   * container that may not have access to custom standalone modules:
   *   1. gatewayConfig module service (ideal, may not resolve)
   *   2. Raw pg Client via DATABASE_URL (always works, independent of container)
   * Results are cached for 5 minutes to avoid repeated DB connections.
   */
  /**
   * Load ALL active Comgate gateway configs (multi-tenant: e.g. CZ merchant
   * 509962 for psi-superzivot/kocici-bible + SK merchant 515357 for
   * pusti-to-sk). Cached 5 minutes as an array; selection happens per call.
   */
  private async getComgateConfigs(): Promise<any[]> {
    // Return cached configs if fresh
    if (_comgateConfigCache && (Date.now() - _comgateConfigCacheTime) < CONFIG_CACHE_TTL) {
      return _comgateConfigCache
    }

    // Method 1: Try gateway config module service
    const gcService = this.getGatewayConfigService()
    if (gcService) {
      try {
        const configs = await gcService.listGatewayConfigs(
          { provider: "comgate", is_active: true },
          { take: 20 }
        )
        if (configs?.length) {
          const sorted = [...configs].sort((a: any, b: any) => (a.priority ?? 99) - (b.priority ?? 99))
          this.getLogger().info(`[Comgate] ${sorted.length} config(s) loaded via gatewayConfig module`)
          _comgateConfigCache = sorted
          _comgateConfigCacheTime = Date.now()
          return sorted
        }
      } catch (e: any) {
        this.getLogger().warn(`[Comgate] Gateway config module query failed: ${e.message}`)
      }
    }

    // Method 2 (__pg_connection__ via scoped container) removed — never resolves
    // reliably inside payment provider DI scope and just polluted logs. Method 3
    // (raw pg Client) is always available and is the canonical fallback.
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
          "SELECT * FROM gateway_config WHERE provider = $1 AND is_active = true AND deleted_at IS NULL ORDER BY priority ASC",
          ["comgate"]
        )
        if (result.rows.length) {
          this.getLogger().info(`[Comgate] ${result.rows.length} config(s) loaded via raw pg (DATABASE_URL)`)
          _comgateConfigCache = result.rows
          _comgateConfigCacheTime = Date.now()
          return result.rows
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
    return []
  }

  /**
   * Pick the right Comgate config for a payment.
   *   - merchant: exact match on the eshop id stored on the session at create
   *     time (used for status/refund/cancel — the transaction's owner).
   *   - projectSlug: match gateway_config.project_slugs (JSON array; filter in
   *     JS per project convention — used at create time).
   *   - fallback: config without project_slugs restriction, else first by priority.
   */
  private async getComgateConfig(projectSlug?: string, merchant?: string): Promise<any> {
    const configs = await this.getComgateConfigs()
    if (!configs.length) return null

    if (merchant) {
      const byMerchant = configs.find((c: any) => {
        const keys = this.getKeysFromConfig(c)
        return keys?.api_key === String(merchant)
      })
      if (byMerchant) return byMerchant
    }

    if (projectSlug) {
      const byProject = configs.find((c: any) => {
        let slugs = c.project_slugs
        if (typeof slugs === "string") { try { slugs = JSON.parse(slugs) } catch { slugs = null } }
        return Array.isArray(slugs) && slugs.includes(projectSlug)
      })
      if (byProject) return byProject
    }

    const unrestricted = configs.find((c: any) => {
      let slugs = c.project_slugs
      if (typeof slugs === "string") { try { slugs = JSON.parse(slugs) } catch { slugs = null } }
      return !Array.isArray(slugs) || slugs.length === 0
    })
    return unrestricted || configs[0]
  }

  /**
   * Initialize a Comgate API client for the given config. Clients are cached
   * per config id (multi-tenant safe — never a single shared client).
   */
  private async getComgateClient(config: any): Promise<ComgateApiClient> {
    if (!config) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Comgate gateway not configured. Set credentials in admin gateway config."
      )
    }
    const cacheKey = String(config.id || "default")
    const cached = _comgateClientCache.get(cacheKey)
    if (cached) return cached

    const parsedKeys = this.getKeysFromConfig(config)
    if (!parsedKeys?.api_key || !parsedKeys?.secret_key) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Comgate merchant ID or secret not configured"
      )
    }
    const client = new ComgateApiClient(parsedKeys.api_key, parsedKeys.secret_key)
    _comgateClientCache.set(cacheKey, client)
    return client
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

      // Multi-tenant: pick the gateway config for THIS project (e.g. SK merchant
      // 515357 for pusti-to-sk vs CZ 509962 for psi-superzivot).
      const projectSlug = sessionData?.project_slug || contextData?.project_slug || ""
      const config = await this.getComgateConfig(projectSlug)
      const client = await this.getComgateClient(config)

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
        "BANK_CZ_CS": "BANK_CZ_CS_PSD2",
        "BANK_CZ_CSOB": "BANK_CZ_CSOB_PSD2",
        "BANK_CZ_MB": "BANK_CZ_MB_PSD2",
        "BANK_CZ_MO": "BANK_CZ_MO_PSD2",
        "BANK_CZ_PB": "BANK_CZ_PB_PSD2",
        "BANK_CZ_UC": "BANK_CZ_UC_PSD2",
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
      else if (rawMethod === "applepay" || rawMethod === "apple_pay") comgateMethod = "APPLEPAY_REDIRECT"
      else if (rawMethod === "googlepay" || rawMethod === "google_pay") comgateMethod = "GOOGLEPAY_REDIRECT"
      else if (rawMethod === "twisto") comgateMethod = "LATER_TWISTO"
      else if (rawMethod === "skippay" || rawMethod === "skip_pay") comgateMethod = "LATER_SKIPPAY"
      else if (rawMethod === "platimpak") comgateMethod = "LATER_PLATIMPAK"
      else if (rawMethod === "twisto_part") comgateMethod = "PART_TWISTO"
      else if (rawMethod === "skippay_part") comgateMethod = "PART_SKIPPAY"
      else if (rawMethod === "essox_part") comgateMethod = "PART_ESSOX"
      else if (rawMethod === "cofidis") comgateMethod = "LOAN_COFIDIS"
      else if (rawMethod === "homecredit") comgateMethod = "LOAN_HOMECREDIT"
      else if (rawMethod === "essox") comgateMethod = "LOAN_ESSOX"
      else if (rawMethod.startsWith("bank_pl_")) comgateMethod = rawMethod.toUpperCase()
      else if (rawMethod.startsWith("bank_cz_")) comgateMethod = LEGACY_TO_PSD2[rawMethod.toUpperCase()] || rawMethod.toUpperCase()
      // Slovak bank buttons (merchant 515357). Tatra + VÚB carry a _P suffix
      // and 365.bank is 365B on the Comgate side — plain toUpperCase() would
      // produce invalid codes, hence the explicit map.
      else if (rawMethod.startsWith("bank_sk_")) {
        const SK_BANK_MAP: Record<string, string> = {
          bank_sk_slsp: "BANK_SK_SLSP",
          bank_sk_tb: "BANK_SK_TB_P",
          bank_sk_vub: "BANK_SK_VUB_P",
          bank_sk_csob: "BANK_SK_CSOB",
          bank_sk_365: "BANK_SK_365B",
          bank_sk_fb: "BANK_SK_FB",
          bank_sk_mb: "BANK_SK_MB",
          bank_sk_pb: "BANK_SK_PB",
          bank_sk_uc: "BANK_SK_UC",
          bank_sk_other: "BANK_SK_OTHER",
        }
        comgateMethod = SK_BANK_MAP[rawMethod] || "BANK_SK_OTHER"
      }
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

      // Credentials must respect config.mode (test vs live) and handle
      // JSON-string keys from the raw-pg fallback — getKeysFromConfig does both.
      const configKeys = this.getKeysFromConfig(config)
      if (!configKeys) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          "Comgate merchant ID or secret not configured"
        )
      }

      const paymentParams = {
        merchant: configKeys.api_key,
        price: priceInCents,
        curr: curr,
        label: descriptor,
        refId: refId,
        secret: configKeys.secret_key,
        email: customerEmail,
        fullName: customerName || undefined, // payer name (Comgate v1.0: fullName; `name` is a product id)
        lang,
        country: billingCountry || countryFallback,
        prepareOnly: true, // get transId + URL without redirect
        method: comgateMethod,
        test: config?.mode !== "live" ? true : undefined, // mark test-mode payments per Comgate protocol
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
          // Owning eshop id — later calls (status/refund/cancel) use it to pick
          // the right merchant among multiple active Comgate configs.
          comgateMerchant: configKeys.api_key,
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
      // Multi-tenant: route to the merchant that created this transaction
      // (comgateMerchant stamped on session data at initiate).
      const config = await this.getComgateConfig(undefined, paymentSessionData?.comgateMerchant)
      const client = await this.getComgateClient(config)
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
      // Multi-tenant: route to the merchant that created this transaction
      // (comgateMerchant stamped on session data at initiate).
      const config = await this.getComgateConfig(undefined, paymentSessionData?.comgateMerchant)
      const client = await this.getComgateClient(config)
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
      // Multi-tenant: route to the merchant that created this transaction.
      const config = await this.getComgateConfig(undefined, paymentSessionData?.comgateMerchant)
      const client = await this.getComgateClient(config)
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
        `[Comgate] Refund created for transId ${transId}: ${Number(refundAmount).toFixed(2)}`
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
      // Multi-tenant: route to the merchant that created this transaction
      // (comgateMerchant stamped on session data at initiate).
      const config = await this.getComgateConfig(undefined, paymentSessionData?.comgateMerchant)
      const client = await this.getComgateClient(config)
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
      // Multi-tenant: route to the merchant that created this transaction
      // (comgateMerchant stamped on session data at initiate).
      const config = await this.getComgateConfig(undefined, paymentSessionData?.comgateMerchant)
      const client = await this.getComgateClient(config)
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

      // Webhook payload carries no session — try every active merchant; the
      // transaction's owner answers, others error out. (In practice the custom
      // /webhooks/comgate route handles this; kept here for contract parity.)
      const configs = await this.getComgateConfigs()
      let config: any = null
      for (const c of configs) {
        const k = this.getKeysFromConfig(c)
        if (!k) continue
        const probeClient = await this.getComgateClient(c)
        const probe = await probeClient.getStatus({ merchant: k.api_key, transId, secret: k.secret_key })
        if (probe.success && probe.data?.status) { config = c; break }
      }
      if (!config) config = await this.getComgateConfig()
      const client = await this.getComgateClient(config)
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
