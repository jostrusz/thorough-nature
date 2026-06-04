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
  token_type?: string
  expires?: number          // unix epoch seconds (Brite's actual field)
  expires_in?: number
  expires_at?: string
  refresh_token?: string
}

/**
 * Brite callback registration. Brite has NO global webhook — instead you
 * register per-session callback URLs keyed to numeric state codes. Brite POSTs
 * to the matching URL when the session/transaction reaches that state.
 *
 * Transaction states (from in-depth-knowledge-transaction-states):
 *   0 CREATED · 1 PENDING · 2 ABORTED(fail) · 3 FAILED · 4 COMPLETED ·
 *   5 CREDIT(ship) · 6 SETTLED(terminal success) · 7 DEBIT(terminal fail)
 * Session states (frontend UI):
 *   10 ABORTED · 11 FAILED · 12 COMPLETED
 */
export interface BriteCallback {
  url: string
  session_state?: number      // 10/11/12
  transaction_state?: number  // 2..7
}

interface BriteSessionRequest {
  amount: number              // amount — UNITS TBD (major vs minor) — confirm in sandbox
  currency_id?: string        // lowercase: "eur" | "sek" | "nok" ...
  country_id?: string         // lowercase ISO-3166-1 alpha-2: "nl" | "se" | "de" ...
  brand_name?: string         // shown to customer in bank app
  merchant_reference: string  // your internal id (intent_id / cart_id)
  locale?: string             // e.g. "nl" | "sv" | "de" | "en"
  redirect_uri: string        // return URL after payment
  deeplink_redirect?: string  // mobile deeplink (optional)
  customer_id?: string
  customer_firstname?: string
  customer_lastname?: string
  customer_email?: string
  customer_dob?: string       // YYYY-MM-DD (optional)
  customer_address?: {
    street?: string
    city?: string
    postal_code?: string
    country_id?: string       // lowercase ISO-3166-1 alpha-2
  }
  // Pre-selected bank id — the OPAQUE token from POST bank.list (e.g. "ag9ofmFib25l...").
  // NOTE: per the Bank-Pre-selection PDF, in the EMBEDDED flow bank_id is passed to the
  // Web SDK client.start({bank_id}) on the FRONTEND, not necessarily here. We still send it
  // server-side as a belt-and-suspenders for the hosted flow.
  bank_id?: string
  // Per-session callbacks (array). Brite POSTs to url when the keyed state is reached.
  callbacks?: BriteCallback[]
  statement_reference?: string // Swish only — message in Swish app (max 50 chars)
  closed_loop?: { nin?: string } // Sweden SSN (optional)
  metadata?: Record<string, any>
}

interface BriteSessionResponse {
  id: string                  // session id
  token?: string              // client-side SDK token (for Web SDK new Brite(token))
  url: string                 // redirect / hosted page URL
  status?: string
}

/** One bank from POST bank.list */
export interface BriteBank {
  id: string                  // opaque bank_id (e.g. "ag9ofmFib25l...CAgN6MkAoM")
  name: string
  country_id: string          // lowercase
  enabled?: boolean
  logo?: string               // base64 data URI (data:image/png;base64,...)
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
  private refreshToken_: string | null = null
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
      // VERIFIED LIVE against sandbox: Brite expects { public_key, secret }
      // (NOT client_id/client_secret). clientId/clientSecret are our internal
      // names — clientId holds the public key, clientSecret holds the secret.
      const response = await axios.post<BriteTokenResponse>(
        `${this.baseUrl}/api/merchant.authorize`,
        {
          public_key: this.clientId,
          secret: this.clientSecret,
        },
        {
          headers: { "Content-Type": "application/json" },
          timeout: 10000,
        }
      )

      this.accessToken = response.data.access_token
      // Response: { access_token, expires (unix epoch seconds), refresh_token }.
      const expires = (response.data as any).expires
      if (typeof expires === "number") {
        this.tokenExpiresAt = new Date(expires * 1000)
      } else if (response.data.expires_at) {
        this.tokenExpiresAt = new Date(response.data.expires_at)
      } else {
        const expiresInSec = response.data.expires_in || 21600 // ~6h default
        this.tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000)
      }
      this.refreshToken_ = (response.data as any).refresh_token || null

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
   * Create an iDEAL payment session (NL only).
   * Brite requires iDEAL to be presented as its own payment method.
   * Endpoint: POST /api/session.create_iDEAL_payment
   * Mandatory: country_id="nl", currency_id="eur".
   */
  async createIdealSession(data: BriteSessionRequest): Promise<BriteSessionResponse> {
    await this.ensureToken()
    try {
      const response = await this.client.post<BriteSessionResponse>(
        "/api/session.create_iDEAL_payment",
        { ...data, country_id: "nl", currency_id: "eur" },
        { headers: this.authHeaders() }
      )
      this.logger.info(`[Brite] iDEAL session created: ${response.data.id}`)
      return response.data
    } catch (error: any) {
      const respData = error.response?.data
      const message = respData?.message || respData?.error || error.message
      this.logger.error(`[Brite] Create iDEAL session failed: ${message} | ${JSON.stringify(respData || {}).slice(0, 400)}`)
      throw new Error(`Failed to create Brite iDEAL session: ${message}`)
    }
  }

  /**
   * Create a Swish payment session (SE only).
   * Brite requires Swish to be presented as its own payment method.
   * Endpoint: POST /api/session.create_swish_payment
   * Mandatory: country_id="se", currency_id="sek", statement_reference (max 50 chars).
   * No customer_id (no returning-user concept for Swish).
   */
  async createSwishSession(data: BriteSessionRequest): Promise<BriteSessionResponse> {
    await this.ensureToken()
    try {
      const statementRef = (data.statement_reference || data.brand_name || "Order").slice(0, 50)
      const response = await this.client.post<BriteSessionResponse>(
        "/api/session.create_swish_payment",
        { ...data, country_id: "se", currency_id: "sek", statement_reference: statementRef },
        { headers: this.authHeaders() }
      )
      this.logger.info(`[Brite] Swish session created: ${response.data.id}`)
      return response.data
    } catch (error: any) {
      const respData = error.response?.data
      const message = respData?.message || respData?.error || error.message
      this.logger.error(`[Brite] Create Swish session failed: ${message} | ${JSON.stringify(respData || {}).slice(0, 400)}`)
      throw new Error(`Failed to create Brite Swish session: ${message}`)
    }
  }

  /**
   * Retrieve the list of supported banks for a market, WITH their opaque bank_id.
   * Endpoint: POST /api/bank.list
   * Response: { banks: [{ id, name, country_id, enabled, logo(base64) }] }
   * This is the ONLY source of the real bank_id used for pre-selection.
   */
  async listBanks(countryId: string): Promise<BriteBank[]> {
    await this.ensureToken()
    try {
      const response = await this.client.post<{ banks: BriteBank[] }>(
        "/api/bank.list",
        { country_id: (countryId || "").toLowerCase() },
        { headers: this.authHeaders() }
      )
      const banks = response.data?.banks || []
      this.logger.info(`[Brite] bank.list ${countryId}: ${banks.length} banks`)
      return banks
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Brite] bank.list failed for ${countryId}: ${message}`)
      throw new Error(`Failed to list Brite banks: ${message}`)
    }
  }

  /**
   * Retrieve a SESSION by id (POST /api/session.get).
   *
   * This is what we store as `briteSessionId` (session.create returns a Session
   * id). transaction.get REJECTS a session id ("we found a Session with given
   * id"), so authorize/status must go through session.get. The response carries
   * the numeric session `state` (12 = COMPLETED) AND the `transaction_id` needed
   * for refunds.
   */
  async getSession(sessionId: string): Promise<any> {
    await this.ensureToken()
    try {
      const response = await this.client.post(
        "/api/session.get",
        { id: sessionId },
        { headers: this.authHeaders() }
      )
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Brite] Get session failed: ${message}`)
      throw new Error(`Failed to retrieve Brite session: ${message}`)
    }
  }

  /**
   * Retrieve a transaction by id (POST /api/transaction.get). Needs a real
   * TRANSACTION id (from session.get → transaction_id), not a session id.
   */
  async getTransaction(transactionId: string): Promise<BriteTransactionResponse> {
    await this.ensureToken()
    try {
      const response = await this.client.post<BriteTransactionResponse>(
        "/api/transaction.get",
        { id: transactionId },
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
