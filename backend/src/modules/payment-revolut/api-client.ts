// @ts-nocheck
import axios, { AxiosInstance } from "axios"
import crypto from "crypto"

/**
 * Revolut Merchant API client (Pay by Bank + general orders).
 *
 * Docs: https://developer.revolut.com/docs/merchant/merchant-api
 *
 * IMPORTANT — amount units:
 *   The Revolut Merchant API expects `amount` in MINOR units (e.g. 4999 = €49.99).
 *   The rest of this codebase works in MAJOR units (49.99). All conversion
 *   (major → minor on the way out, minor → major on the way in) happens HERE,
 *   in the api-client layer only — never leak minor units to the service.
 *
 * Auth: Bearer <secret API key> + `Revolut-Api-Version` header.
 */

// Pinned Merchant API version (matches Revolut's official integration example).
const REVOLUT_API_VERSION = "2024-09-01"

export interface RevolutOrder {
  id: string
  token: string
  state: string
  amount: number          // MAJOR units (already converted from API minor units)
  currency: string
  description?: string
  checkout_url?: string
  refunded_amount?: number
  payments?: any[]
  [key: string]: any
}

export interface RevolutCreateOrderInput {
  amount: number          // MAJOR units (e.g. 49.99) — converted to minor here
  currency: string
  description?: string
  /** Optional external reference (e.g. Medusa cart id) for reconciliation. */
  merchant_order_ext_ref?: string
}

export class RevolutApiClient {
  private client: AxiosInstance
  private baseUrl: string
  private secretKey: string

  /**
   * @param secretKey  Merchant API SECRET key (server-side only, never exposed).
   * @param isTest     true = sandbox-merchant.revolut.com, false = merchant.revolut.com
   */
  constructor(secretKey: string, isTest: boolean = true) {
    this.secretKey = secretKey
    this.baseUrl = isTest
      ? "https://sandbox-merchant.revolut.com"
      : "https://merchant.revolut.com"

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        "Revolut-Api-Version": REVOLUT_API_VERSION,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
  }

  /** Convert MAJOR units (49.99) → MINOR units (4999) for the Revolut API. */
  private toMinor(amount: number): number {
    return Math.round(Number(amount) * 100)
  }

  /** Convert MINOR units (4999) → MAJOR units (49.99) coming back from the API. */
  private toMajor(amount: number | undefined | null): number {
    return amount == null ? 0 : Number(amount) / 100
  }

  /** Normalise a raw Revolut order payload into our MAJOR-unit shape. */
  private normalizeOrder(raw: any): RevolutOrder {
    return {
      ...raw,
      id: raw.id,
      token: raw.token,
      state: String(raw.state || "").toUpperCase(),
      amount: this.toMajor(raw.order_amount?.value ?? raw.amount),
      currency: (raw.order_amount?.currency || raw.currency || "").toUpperCase(),
      refunded_amount: this.toMajor(raw.refunded_amount),
    }
  }

  /**
   * Create a Revolut order. Returns the order with a public `token`
   * (used to initialise the Pay by Bank widget on the storefront).
   * POST /api/orders
   */
  async createOrder(input: RevolutCreateOrderInput): Promise<RevolutOrder> {
    const body: Record<string, any> = {
      amount: this.toMinor(input.amount),
      currency: input.currency.toUpperCase(),
    }
    if (input.description) body.description = input.description
    if (input.merchant_order_ext_ref) {
      body.merchant_order_ext_ref = input.merchant_order_ext_ref
    }

    const { data } = await this.client.post("/api/orders", body)
    return this.normalizeOrder(data)
  }

  /**
   * Retrieve a Revolut order by id.
   * GET /api/orders/{id}
   */
  async getOrder(orderId: string): Promise<RevolutOrder> {
    const { data } = await this.client.get(`/api/orders/${orderId}`)
    return this.normalizeOrder(data)
  }

  /**
   * Capture an authorised order (no-op for orders already auto-completed).
   * POST /api/orders/{id}/capture
   */
  async captureOrder(orderId: string, amount?: number, currency?: string): Promise<RevolutOrder> {
    const body: Record<string, any> = {}
    if (amount != null && currency) {
      body.amount = this.toMinor(amount)
      body.currency = currency.toUpperCase()
    }
    const { data } = await this.client.post(`/api/orders/${orderId}/capture`, body)
    return this.normalizeOrder(data)
  }

  /**
   * Refund a (fully or partially) paid order.
   * POST /api/orders/{id}/refund
   */
  async refundOrder(orderId: string, amount: number, currency: string, description?: string): Promise<any> {
    const body: Record<string, any> = {
      amount: this.toMinor(amount),
      currency: currency.toUpperCase(),
    }
    if (description) body.description = description
    const { data } = await this.client.post(`/api/orders/${orderId}/refund`, body)
    return data
  }

  /**
   * Cancel an order that has not been paid yet.
   * POST /api/orders/{id}/cancel
   */
  async cancelOrder(orderId: string): Promise<RevolutOrder> {
    const { data } = await this.client.post(`/api/orders/${orderId}/cancel`, {})
    return this.normalizeOrder(data)
  }

  /**
   * Verify a Revolut webhook signature.
   *
   * Revolut signs webhooks with HMAC-SHA256 over the string
   *   "{signatureVersion}.{requestTimestamp}.{rawBody}"
   * using the per-webhook `signing_secret`. The `Revolut-Signature` header is
   * "{signatureVersion}={hexDigest}" (e.g. "v1=abc123...").
   *
   * See: https://developer.revolut.com/docs/guides/accept-payments/tutorials/work-with-webhooks/verify-the-payload-signature
   */
  static verifyWebhookSignature(opts: {
    rawBody: string
    signatureHeader: string
    timestampHeader: string
    signingSecret: string
  }): boolean {
    const { rawBody, signatureHeader, timestampHeader, signingSecret } = opts
    if (!rawBody || !signatureHeader || !timestampHeader || !signingSecret) {
      return false
    }
    const version = signatureHeader.substring(0, signatureHeader.indexOf("="))
    if (!version) return false

    const payloadToSign = `${version}.${timestampHeader}.${rawBody}`
    const expected =
      `${version}=` +
      crypto.createHmac("sha256", signingSecret).update(payloadToSign).digest("hex")

    // Constant-time compare
    const a = Buffer.from(signatureHeader)
    const b = Buffer.from(expected)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  }

  /** Webhook replay protection — reject timestamps older than 5 minutes. */
  static isTimestampFresh(timestampHeader: string, toleranceMs = 300000): boolean {
    const ts = Number(timestampHeader)
    if (!ts || Number.isNaN(ts)) return false
    const diff = Date.now() - ts
    return diff >= 0 && diff <= toleranceMs
  }
}
