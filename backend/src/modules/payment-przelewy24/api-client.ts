// @ts-nocheck
import axios, { AxiosInstance } from "axios"
import crypto from "crypto"

export interface IP24TransactionRegisterParams {
  merchantId: string
  posId: string
  sessionId: string
  amount: number // in grosze (smallest currency unit)
  currency: string
  description: string
  email: string
  country: string
  urlReturn: string
  urlStatus: string
  crc: string
}

export interface IP24TransactionVerifyParams {
  merchantId: string
  posId: string
  sessionId: string
  orderId: string
  amount: number // in grosze
  currency: string
  crc: string
}

export interface IP24RefundParams {
  requestId: string
  refunds: Array<{
    orderId: string
    sessionId: string
    amount: number // in grosze
    description: string
  }>
  urlStatus: string
}

export interface IP24PaymentMethod {
  id: string
  name: string
  description?: string
  type?: string
  icon?: string
}

/**
 * Calculate SHA-384 checksum for P24 transaction signing
 * Format: sessionId|merchantId|amount|currency|crc (for register)
 */
function calculateP24Sign(parts: string[]): string {
  const concatenated = parts.join("|")
  return crypto.createHash("sha384").update(concatenated).digest("hex")
}

export class Przelewy24ApiClient {
  private client: AxiosInstance
  private merchantId: string
  private posId: string
  private apiKey: string // REST API key (used for HTTP Basic Auth)
  private crc: string
  private testMode: boolean

  constructor(
    merchantId: string,
    posId: string,
    apiKey: string,
    crc: string,
    testMode: boolean = true
  ) {
    this.merchantId = merchantId
    this.posId = posId
    this.apiKey = apiKey
    this.crc = crc
    this.testMode = testMode

    const baseURL = testMode
      ? "https://sandbox.przelewy24.pl"
      : "https://secure.przelewy24.pl"

    // HTTP Basic Auth with pos_id as username and api_key as password
    const basicAuth = Buffer.from(`${posId}:${apiKey}`).toString("base64")

    this.client = axios.create({
      baseURL,
      timeout: 10000,
      headers: {
        Authorization: `Basic ${basicAuth}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    })
  }

  /**
   * Register a transaction with P24
   * Returns token to be used in redirect URL: https://secure.przelewy24.pl/trnRequest/{token}
   */
  async registerTransaction(params: IP24TransactionRegisterParams): Promise<{
    success: boolean
    data?: {
      token?: string
      transactionUrl?: string
    }
    error?: string
  }> {
    try {
      // Calculate sign: sessionId|merchantId|amount|currency|crc
      const sign = calculateP24Sign([
        params.sessionId,
        params.merchantId,
        params.amount.toString(),
        params.currency,
        params.crc,
      ])

      const payload = {
        merchantId: params.merchantId,
        posId: params.posId,
        sessionId: params.sessionId,
        amount: params.amount,
        currency: params.currency,
        description: params.description,
        email: params.email,
        country: params.country,
        urlReturn: params.urlReturn,
        urlStatus: params.urlStatus,
        sign,
      }

      const response = await this.client.post(
        "/api/v1/transaction/register",
        payload
      )

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "Transaction registration failed",
        }
      }

      const token = response.data?.data?.token
      if (!token) {
        return {
          success: false,
          error: "No token returned from P24",
        }
      }

      const transactionUrl = `${
        this.testMode
          ? "https://sandbox.przelewy24.pl"
          : "https://secure.przelewy24.pl"
      }/trnRequest/${token}`

      return {
        success: true,
        data: {
          token,
          transactionUrl,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to register transaction",
      }
    }
  }

  /**
   * Verify transaction after payment completion
   * Called when webhook is received
   */
  async verifyTransaction(params: IP24TransactionVerifyParams): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      // Calculate sign: sessionId|orderId|amount|currency|crc
      const sign = calculateP24Sign([
        params.sessionId,
        params.orderId,
        params.amount.toString(),
        params.currency,
        params.crc,
      ])

      const payload = {
        merchantId: params.merchantId,
        posId: params.posId,
        sessionId: params.sessionId,
        orderId: params.orderId,
        amount: params.amount,
        currency: params.currency,
        sign,
      }

      const response = await this.client.put(
        "/api/v1/transaction/verify",
        payload
      )

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "Transaction verification failed",
        }
      }

      return {
        success: true,
        data: response.data?.data || response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to verify transaction",
      }
    }
  }

  /**
   * Create a refund for a transaction
   */
  async createRefund(params: IP24RefundParams): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const payload = {
        requestId: params.requestId,
        refunds: params.refunds,
        urlStatus: params.urlStatus,
      }

      const response = await this.client.post(
        "/api/v1/transaction/refund",
        payload
      )

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "Refund creation failed",
        }
      }

      return {
        success: true,
        data: response.data?.data || response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to create refund",
      }
    }
  }

  /**
   * Get available payment methods for a language and currency
   */
  async getPaymentMethods(lang: string, currency: string): Promise<{
    success: boolean
    data?: IP24PaymentMethod[]
    error?: string
  }> {
    try {
      const response = await this.client.get(
        `/api/v1/payment/methods/${lang}/${currency}`
      )

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "Failed to get payment methods",
        }
      }

      const methods = response.data?.data || []

      return {
        success: true,
        data: methods,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to fetch payment methods",
      }
    }
  }

  /**
   * Test access to P24 API
   */
  async testAccess(): Promise<{
    success: boolean
    error?: string
  }> {
    try {
      const response = await this.client.get("/api/v1/testAccess")

      if (response.data?.status !== 0) {
        return {
          success: false,
          error: response.data?.message || "API access test failed",
        }
      }

      return {
        success: true,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.response?.data?.error ||
          error.message ||
          "Failed to test API access",
      }
    }
  }
}
