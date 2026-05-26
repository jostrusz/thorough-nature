// @ts-nocheck
import axios, { AxiosInstance } from "axios"
import crypto from "crypto"
import { Logger } from "@medusajs/framework/logger"

/**
 * Brite Payments REST API Client
 *
 * Open-banking (Pay by Bank) provider with instant settlement.
 * OAuth 2.0 bearer authentication with token refresh.
 *
 * Endpoint conventions (from public docs):
 *  - POST /api/merchant.authorize         → token (client_id + client_secret in body)
 *  - POST /api/session.create_deposit     → create payment session
 *  - POST /api/transaction.get            → retrieve transaction
 *  - POST /api/transaction.create_refund  → refund a paid transaction
 *
 * Base URLs:
 *  - Sandbox:    https://sandbox.britepaymentgroup.com
 *  - Production: https://api.britepaymentgroup.com  (verify once live merchant account is provisioned)
 *
 * NOTE: Brite uses "RPC-style" endpoints (POST .verb-named paths), not REST resources.
 */

interface BriteTokenResponse {
  access_token: string
  token_type: string
  expires_in?: number
  expires_at?: string
}

interface BriteSessionRequest {
  amount: number              // major units
  currency: string            // ISO-4217 (EUR, SEK, NOK, GBP, PLN, etc.)
  country_id?: string         // ISO-3166-1 alpha-2 (NL, SE, DE, ...)
  brand_name?: string         // shown to customer in bank app
  merchant_reference: string  // your internal id (intent_id / cart_id)
  locale?: string             // e.g. nl_NL, sv_SE, de_DE, en_GB
  redirect_uri: string        // return URL after payment
  deeplink_redirect?: string  // mobile deeplink (optional)
  customer_id?: string
  customer_firstname?: string
  customer_lastname?: string
  customer_email?: string
  customer_dob?: string       // YYYY-MM-DD (Klarna-style KYC; optional)
  customer_address?: {
    street?: string
    city?: string
    postal_code?: string
    country_id?: string       // ISO-3166-1 alpha-2
  }
  // Pre-selected bank — skips Brite's bank picker (customer goes straight to bank login).
  // Exact field name per Brite docs is TBD; common variants include `bank_id`, `aspsp_id`,
  // and a nested `bank: { id }`. We send all three so whichever Brite expects gets matched.
  bank_id?: string
  aspsp_id?: string
  bank?: { id: string }
  callbacks?: {
    success?: string
    pending?: string
    fail?: string
  }
  // Optional metadata pass-through (Brite usually echoes this in transaction object)
  metadata?: Record<string, any>
}

interface BriteSessionResponse {
  id: string                  // session id
  token?: string              // client-side SDK token
  url: string                 // redirect / iframe URL
  status?: string
}

interface BriteTransactionResponse {
  id: string
  session_id?: string
  state?: string              // "PENDING_PROCESSING", "COMPLETED", "FAILED", ...
  status?: string             // same — Brite uses both names in different responses
  amount?: number
  currency?: string
  merchant_reference?: string
  bank?: { id: string; name: string; country_id?: string }
  created_at?: string
  updated_at?: string
  failure_reason?: string
}

interface BriteRefundRequest {
  amount: number
  transaction_id: string
  merchant_reference: string
  callbacks?: {
    success?: string
    fail?: string
  }
}

interface BriteRefundResponse {
  id: string
  transaction_id: string
  amount: number
  state?: string
  status?: string
}

export class BriteApiClient {
  private client: AxiosInstance
  private baseUrl: string
  private clientId: string
  private clientSecret: string
  private accessToken: string | null = null
  private tokenExpiresAt: Date | null = null
  private logger: Logger
  private isRefreshing = false
  private refreshQueue: Array<() => void> = []

  constructor(
    clientId: string,
    clientSecret: string,
    isTest: boolean = true,
    logger: Logger,
    customBaseUrl?: string
  ) {
    this.clientId = clientId
    this.clientSecret = clientSecret
    this.logger = logger
    this.baseUrl = customBaseUrl || (isTest
      ? "https://sandbox.britepaymentgroup.com"
      : "https://api.britepaymentgroup.com")

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    })

    // Auto-refresh on 401
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true

          if (!this.isRefreshing) {
            this.isRefreshing = true
            try {
              await this.authenticate()
              this.isRefreshing = false
              this.refreshQueue.forEach((cb) => cb())
              this.refreshQueue = []
              originalRequest.headers.Authorization = `Bearer ${this.accessToken}`
              return this.client(originalRequest)
            } catch (refreshError) {
              this.isRefreshing = false
              this.refreshQueue = []
              this.logger.error(
                `[Brite] Token refresh failed: ${(refreshError as Error).message}`
              )
              return Promise.reject(refreshError)
            }
          }

          return new Promise((resolve, reject) => {
            this.refreshQueue.push(() => {
              originalRequest.headers.Authorization = `Bearer ${this.accessToken}`
              resolve(this.client(originalRequest))
            })
          })
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * OAuth 2.0: exchange client_id + client_secret for a bearer access_token.
   */
  async authenticate(): Promise<void> {
    try {
      const response = await axios.post<BriteTokenResponse>(
        `${this.baseUrl}/api/merchant.authorize`,
        {
          client_id: this.clientId,
          client_secret: this.clientSecret,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      )

      this.accessToken = response.data.access_token
      if (response.data.expires_at) {
        this.tokenExpiresAt = new Date(response.data.expires_at)
      } else {
        const expiresInSec = response.data.expires_in || 3600
        this.tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000)
      }

      this.logger.info(
        `[Brite] Authenticated. Token expires at ${this.tokenExpiresAt.toISOString()}`
      )
    } catch (error: any) {
      const msg = error.response?.data?.message || error.response?.data?.error || error.message
      this.logger.error(`[Brite] Authentication failed: ${msg}`)
      throw new Error(`Brite authentication failed: ${msg}`)
    }
  }

  /**
   * Ensure a valid access token (refresh 60s before expiry).
   */
  private async ensureToken(): Promise<void> {
    if (!this.accessToken || !this.tokenExpiresAt) {
      await this.authenticate()
      return
    }
    const bufferMs = 60_000
    if (Date.now() + bufferMs >= this.tokenExpiresAt.getTime()) {
      await this.authenticate()
    }
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
    }
  }

  /**
   * Create a deposit (= payment) session.
   * Returns { id, url, token } — the url is where the customer is redirected.
   */
  async createSession(data: BriteSessionRequest): Promise<BriteSessionResponse> {
    await this.ensureToken()
    try {
      const response = await this.client.post<BriteSessionResponse>(
        "/api/session.create_deposit",
        data,
        { headers: this.authHeaders() }
      )
      this.logger.info(`[Brite] Session created: ${response.data.id}`)
      return response.data
    } catch (error: any) {
      const respData = error.response?.data
      const message = respData?.message || respData?.error || error.message
      const details = respData ? JSON.stringify(respData).slice(0, 500) : `status=${error.response?.status}`
      this.logger.error(`[Brite] Create session failed: ${message} | ${details}`)
      throw new Error(`Failed to create Brite session: ${message}`)
    }
  }

  /**
   * Retrieve a transaction (session) by id.
   */
  async getTransaction(transactionId: string): Promise<BriteTransactionResponse> {
    await this.ensureToken()
    try {
      const response = await this.client.post<BriteTransactionResponse>(
        "/api/transaction.get",
        { transaction_id: transactionId },
        { headers: this.authHeaders() }
      )
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Brite] Get transaction failed: ${message}`)
      throw new Error(`Failed to retrieve Brite transaction: ${message}`)
    }
  }

  /**
   * Create a refund against a completed transaction.
   */
  async createRefund(data: BriteRefundRequest): Promise<BriteRefundResponse> {
    await this.ensureToken()
    try {
      const response = await this.client.post<BriteRefundResponse>(
        "/api/transaction.create_refund",
        data,
        { headers: this.authHeaders() }
      )
      this.logger.info(`[Brite] Refund created: ${response.data.id}`)
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Brite] Create refund failed: ${message}`)
      throw new Error(`Failed to create Brite refund: ${message}`)
    }
  }

  /**
   * Verify a Brite webhook HMAC signature.
   * Algorithm/header name to be confirmed once sandbox docs are available;
   * defaults follow the open-banking industry norm of HMAC-SHA256 over the raw body.
   */
  static verifySignature(
    rawBody: string,
    signatureHeader: string | undefined,
    webhookSecret: string
  ): boolean {
    if (!signatureHeader || !webhookSecret) return false
    try {
      const expected = crypto
        .createHmac("sha256", webhookSecret)
        .update(rawBody, "utf8")
        .digest("hex")
      // Accept both raw hex and "sha256=<hex>" formats.
      const cleaned = signatureHeader.replace(/^sha256=/i, "").trim()
      // timing-safe compare
      const a = Buffer.from(cleaned, "utf8")
      const b = Buffer.from(expected, "utf8")
      if (a.length !== b.length) return false
      return crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  }
}

/**
 * Brite Service Presentation API — separate auth-less (merchant_id-scoped) endpoint
 * that returns localised badges, taglines, and BANK LOGOS for use on your checkout.
 *
 * Doc: https://docs.britepayments.com/technical-documentation/service-presentation-api/
 * Endpoint base:
 *   Sandbox:    https://presentation.sandbox.britepayments.io/v1/assets/
 *   Production: https://presentation.britepayments.io/v1/assets/
 *
 * Brite recommends polling once per day and caching the result.
 */
export class BritePresentationClient {
  private baseUrl: string
  private merchantId: string
  private logger: Logger

  constructor(merchantId: string, isTest: boolean, logger: Logger) {
    this.merchantId = merchantId
    this.logger = logger
    this.baseUrl = isTest
      ? "https://presentation.sandbox.britepayments.io/v1/assets/"
      : "https://presentation.britepayments.io/v1/assets/"
  }

  /**
   * Fetch presentation assets (incl. bank_logos) for a locale.
   *
   * @param locale  e.g. "nl_NL", "sv_SE", "de_DE", "en_GB"
   * @param vertical  default "ecommerce"
   * @param productType  default "payment"
   */
  async fetchAssets(
    locale: string,
    vertical: string = "ecommerce",
    productType: string = "payment"
  ): Promise<{
    badge?: string
    title?: string
    tagline?: string
    extended_descriptor_text?: string[]
    bank_logos?: string[]
    raw?: any
  }> {
    try {
      const response = await axios.get(this.baseUrl, {
        params: {
          merchant_id: this.merchantId,
          vertical,
          product_type: productType,
          locale,
        },
        timeout: 15000,
      })
      return {
        badge: response.data?.badge,
        title: response.data?.title,
        tagline: response.data?.tagline,
        extended_descriptor_text: response.data?.extended_descriptor_text,
        bank_logos: response.data?.bank_logos || [],
        raw: response.data,
      }
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.warn(`[Brite Presentation] fetchAssets(${locale}) failed: ${message}`)
      throw new Error(`Brite Presentation fetch failed: ${message}`)
    }
  }
}
