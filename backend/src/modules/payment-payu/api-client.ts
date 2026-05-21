// @ts-nocheck
import axios, { AxiosInstance } from "axios"
import crypto from "crypto"
import { Logger } from "@medusajs/framework/logger"

/**
 * PayU GPO Europe REST API Client (REST 2.1)
 *
 * Docs: https://developers.payu.com/europe/api/
 * Base URLs:
 *   - Production: https://secure.payu.com
 *   - Sandbox:    https://secure.snd.payu.com
 *
 * Auth: OAuth2 client_credentials, token TTL ~12h.
 * Amounts: PayU uses MINOR units as STRING ("21000" = 210.00 PLN).
 *   This client accepts amounts in MAJOR units (e.g. 49.99) and converts internally.
 *   Helper: toMinorString(49.99) → "4999"
 */

interface PayUTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  grant_type: string
}

interface PayUOrderProduct {
  name: string
  unitPrice: string | number // minor units as string
  quantity: number | string
}

interface PayUOrderBuyer {
  email?: string
  firstName?: string
  lastName?: string
  language?: string
  phone?: string
}

interface PayUOrderCreateRequest {
  merchantPosId: string
  customerIp: string
  description: string
  currencyCode: string // ISO-4217: PLN, EUR, CZK, ...
  totalAmount: string | number // minor units
  extOrderId: string // your unique idempotency key (= cart_id)
  continueUrl?: string
  notifyUrl?: string
  buyer?: PayUOrderBuyer
  products: PayUOrderProduct[]
  payMethods?: { payMethod: { type: string; value: string } }
}

interface PayUOrderCreateResponse {
  status: { statusCode: string; statusDesc?: string; severity?: string }
  redirectUri?: string
  orderId: string
  extOrderId?: string
  iframeAllowed?: boolean
}

interface PayURefundRequest {
  orderId: string
  description?: string
  amount?: string // minor units; omit for full refund
  currencyCode?: string
  extRefundId?: string
}

/** Convert MAJOR units (49.99) → MINOR units STRING ("4999") */
export function toMinorString(majorAmount: number | string): string {
  const n = typeof majorAmount === "number" ? majorAmount : Number(majorAmount)
  if (!isFinite(n)) return "0"
  // Round to nearest cent to avoid float drift (e.g. 49.99 * 100 = 4998.999...)
  return String(Math.round(n * 100))
}

/** Convert MINOR units STRING ("4999") → MAJOR units number (49.99) */
export function fromMinor(minor: string | number): number {
  const n = typeof minor === "number" ? minor : Number(minor)
  if (!isFinite(n)) return 0
  return Math.round(n) / 100
}

export class PayUApiClient {
  private client: AxiosInstance
  private baseUrl: string
  private posId: string
  private clientSecret: string
  private accessToken: string | null = null
  private tokenExpiresAt: number = 0 // ms epoch
  private logger: Logger
  private isRefreshing = false
  private refreshQueue: Array<() => void> = []

  constructor(
    posId: string,
    clientSecret: string,
    isTest: boolean,
    logger: Logger
  ) {
    this.posId = posId
    this.clientSecret = clientSecret
    this.logger = logger
    this.baseUrl = isTest
      ? "https://secure.snd.payu.com"
      : "https://secure.payu.com"

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      // CRITICAL: POST /api/v2_1/orders returns 302 with redirectUri header;
      // by default axios follows it and we lose the JSON body.
      maxRedirects: 0,
      // Treat 302 as success so we can read body + redirectUri header
      validateStatus: (status) => (status >= 200 && status < 400),
    })

    // 401 → refresh token + retry
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true
          if (!this.isRefreshing) {
            this.isRefreshing = true
            try {
              await this.login()
              this.isRefreshing = false
              this.refreshQueue.forEach((cb) => cb())
              this.refreshQueue = []
              originalRequest.headers.Authorization = `Bearer ${this.accessToken}`
              return this.client(originalRequest)
            } catch (refreshError) {
              this.isRefreshing = false
              this.refreshQueue = []
              return Promise.reject(refreshError)
            }
          }
          return new Promise((resolve) => {
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

  /** OAuth2 client_credentials login, caches token until 60s before expiry */
  async login(): Promise<void> {
    try {
      const params = new URLSearchParams()
      params.append("grant_type", "client_credentials")
      params.append("client_id", this.posId)
      params.append("client_secret", this.clientSecret)

      // OAuth endpoint accepts redirects fine; use a plain axios to bypass interceptor
      const response = await axios.post<PayUTokenResponse>(
        `${this.baseUrl}/pl/standard/user/oauth/authorize`,
        params.toString(),
        {
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          timeout: 10000,
        }
      )

      this.accessToken = response.data.access_token
      // expires_in is seconds; cache until 60s before expiry
      const ttlMs = (Number(response.data.expires_in) || 43199) * 1000
      this.tokenExpiresAt = Date.now() + ttlMs - 60_000

      this.logger.info(
        `[PayU] Authenticated, token TTL=${response.data.expires_in}s, expires≈${new Date(this.tokenExpiresAt).toISOString()}`
      )
    } catch (error: any) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
      this.logger.error(`[PayU] Authentication failed: ${detail}`)
      throw new Error(`PayU authentication failed: ${detail}`)
    }
  }

  private async ensureToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.login()
    }
  }

  private authHeaders(contentType = true): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
    }
    if (contentType) headers["Content-Type"] = "application/json"
    return headers
  }

  /**
   * Create a PayU order.
   * Returns { redirectUri, orderId, extOrderId, status }.
   * status.statusCode = "SUCCESS" — already paid (rare, recurring)
   *                   = "WARNING_CONTINUE_REDIRECT" — normal, redirect customer to redirectUri
   *                   = "WARNING_CONTINUE_3DS" / "_CVV" — card 3DS step
   */
  async createOrder(data: PayUOrderCreateRequest): Promise<PayUOrderCreateResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.post(
        "/api/v2_1/orders",
        data,
        { headers: this.authHeaders() }
      )

      // PayU returns 302 with Location header on success — body still contains JSON
      const body = response.data || {}
      // Sometimes redirectUri arrives only in Location header
      if (!body.redirectUri && response.headers?.location) {
        body.redirectUri = response.headers.location
      }
      this.logger.info(
        `[PayU] Order created: orderId=${body.orderId}, extOrderId=${body.extOrderId}, status=${body?.status?.statusCode}, redirect=${body.redirectUri ? "yes" : "no"}`
      )
      return body as PayUOrderCreateResponse
    } catch (error: any) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
      this.logger.error(`[PayU] Create order failed: ${detail}`)
      throw new Error(`Failed to create PayU order: ${detail}`)
    }
  }

  /** Retrieve a PayU order by orderId (PayU's ID, not extOrderId) */
  async getOrder(orderId: string): Promise<any> {
    await this.ensureToken()
    try {
      const response = await this.client.get(
        `/api/v2_1/orders/${orderId}`,
        { headers: this.authHeaders(false) }
      )
      return response.data
    } catch (error: any) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
      this.logger.error(`[PayU] Get order failed: ${detail}`)
      throw new Error(`Failed to retrieve PayU order: ${detail}`)
    }
  }

  /**
   * Capture an order (only when POS auto-receive is OFF and order is WAITING_FOR_CONFIRMATION).
   * Default POS config uses auto-receive ON — this becomes a no-op there.
   */
  async captureOrder(orderId: string): Promise<any> {
    await this.ensureToken()
    try {
      const response = await this.client.put(
        `/api/v2_1/orders/${orderId}/status`,
        { orderId, orderStatus: "COMPLETED" },
        { headers: this.authHeaders() }
      )
      this.logger.info(`[PayU] Order captured: ${orderId}`)
      return response.data
    } catch (error: any) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
      this.logger.error(`[PayU] Capture order failed: ${detail}`)
      throw new Error(`Failed to capture PayU order: ${detail}`)
    }
  }

  /** Cancel/void a PayU order (also used to refund an uncaptured order) */
  async cancelOrder(orderId: string): Promise<any> {
    await this.ensureToken()
    try {
      const response = await this.client.delete(
        `/api/v2_1/orders/${orderId}`,
        { headers: this.authHeaders(false) }
      )
      this.logger.info(`[PayU] Order cancelled: ${orderId}`)
      return response.data
    } catch (error: any) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
      this.logger.error(`[PayU] Cancel order failed: ${detail}`)
      throw new Error(`Failed to cancel PayU order: ${detail}`)
    }
  }

  /**
   * Create a refund. Omit `amount` for full refund. Async — final state arrives via IPN.
   * Cannot refund WAITING_FOR_CONFIRMATION orders — cancel them first.
   */
  async createRefund(data: PayURefundRequest): Promise<any> {
    await this.ensureToken()
    const { orderId, ...refundBody } = data
    try {
      const response = await this.client.post(
        `/api/v2_1/orders/${orderId}/refunds`,
        {
          refund: {
            description: refundBody.description || "Customer requested refund",
            ...(refundBody.amount ? { amount: refundBody.amount } : {}),
            ...(refundBody.currencyCode ? { currencyCode: refundBody.currencyCode } : {}),
            ...(refundBody.extRefundId ? { extRefundId: refundBody.extRefundId } : {}),
          },
        },
        { headers: this.authHeaders() }
      )
      this.logger.info(`[PayU] Refund created for order ${orderId}, amount=${refundBody.amount || "FULL"}`)
      return response.data
    } catch (error: any) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
      this.logger.error(`[PayU] Refund failed: ${detail}`)
      throw new Error(`Failed to create PayU refund: ${detail}`)
    }
  }

  /**
   * GET /api/v2_1/paymethods — list enabled methods for this POS.
   * Useful for admin "live preview" of available methods + frontend dynamic listing.
   */
  async getPaymentMethods(): Promise<any> {
    await this.ensureToken()
    try {
      const response = await this.client.get(
        "/api/v2_1/paymethods",
        { headers: this.authHeaders(false) }
      )
      return response.data
    } catch (error: any) {
      const detail = error.response?.data ? JSON.stringify(error.response.data) : error.message
      this.logger.error(`[PayU] Get paymethods failed: ${detail}`)
      throw new Error(`Failed to list PayU payment methods: ${detail}`)
    }
  }

  /**
   * Verify IPN signature.
   * Header: OpenPayu-Signature: sender=checkout;signature={hash};algorithm=MD5|SHA-256;content=DOCUMENT
   * Expected: hash = HASH(rawBody + secondKey)
   */
  static verifyIpnSignature(
    rawBody: string,
    signatureHeader: string,
    secondKey: string
  ): boolean {
    if (!signatureHeader || !secondKey) return false
    // Parse header into key/value map
    const parts = signatureHeader.split(";").reduce((acc: Record<string, string>, kv) => {
      const [k, v] = kv.split("=")
      if (k && v) acc[k.trim().toLowerCase()] = v.trim()
      return acc
    }, {})
    const signature = parts.signature
    const algorithm = (parts.algorithm || "MD5").toUpperCase()
    if (!signature) return false

    let expected: string
    try {
      if (algorithm === "SHA-256" || algorithm === "SHA256") {
        expected = crypto.createHash("sha256").update(rawBody + secondKey, "utf8").digest("hex")
      } else {
        // Default MD5 (most common, older POSes)
        expected = crypto.createHash("md5").update(rawBody + secondKey, "utf8").digest("hex")
      }
    } catch {
      return false
    }
    // Constant-time compare
    if (signature.length !== expected.length) return false
    try {
      return crypto.timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expected, "hex"))
    } catch {
      return false
    }
  }
}
