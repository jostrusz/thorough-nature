// @ts-nocheck
import axios, { AxiosInstance } from "axios"
import crypto from "crypto"
import { Logger } from "@medusajs/framework/logger"

/**
 * Airwallex REST API Client
 * Handles authentication with Bearer token and all payment operations
 */

interface AirwallexLoginResponse {
  token: string
  expires_at: string
}

interface AirwallexPaymentIntentRequest {
  amount: number
  currency: string
  merchant_order_id: string
  descriptor?: string
  return_url?: string
  metadata?: Record<string, any>
  order?: Record<string, any>
  customer?: {
    email?: string
    first_name?: string
    last_name?: string
    phone_number?: string
  }
}

interface AirwallexPaymentIntentResponse {
  id: string
  amount: number
  currency: string
  status: string
  client_secret: string
  merchant_order_id: string
  created_at: string
  updated_at: string
  metadata?: Record<string, any>
  next_action?: {
    type: string
    url?: string
    [key: string]: any
  }
}

interface AirwallexConfirmRequest {
  payment_method: {
    type: string
    [key: string]: any
  }
  return_url?: string
  order?: Record<string, any>
}

interface AirwallexCaptureRequest {
  amount?: number
}

interface AirwallexRefundRequest {
  payment_intent_id: string
  amount?: number
  reason?: string
}

interface AirwallexRefundResponse {
  id: string
  payment_intent_id: string
  amount: number
  currency: string
  status: string
  reason?: string
  created_at: string
}

export class AirwallexApiClient {
  private client: AxiosInstance
  private baseUrl: string
  private clientId: string
  private apiKey: string
  private accountId: string | null = null
  private bearerToken: string | null = null
  private tokenExpiresAt: Date | null = null
  private logger: Logger
  private isRefreshing = false
  private refreshQueue: Array<() => void> = []

  constructor(
    clientId: string,
    apiKey: string,
    isTest: boolean = true,
    logger: Logger,
    accountId?: string
  ) {
    this.clientId = clientId
    this.apiKey = apiKey
    this.accountId = accountId || null
    this.logger = logger
    this.baseUrl = isTest
      ? "https://api-demo.airwallex.com"
      : "https://api.airwallex.com"

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    })

    // Add response interceptor for token refresh
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

              // Retry queued requests
              this.refreshQueue.forEach((cb) => cb())
              this.refreshQueue = []

              // Retry original request
              return this.client(originalRequest)
            } catch (refreshError) {
              this.isRefreshing = false
              this.refreshQueue = []
              this.logger.error(
                `[Airwallex] Token refresh failed: ${(refreshError as Error).message}`
              )
              return Promise.reject(refreshError)
            }
          }

          // Queue request while refreshing
          return new Promise((resolve, reject) => {
            this.refreshQueue.push(() => {
              resolve(this.client(originalRequest))
            })
          })
        }

        return Promise.reject(error)
      }
    )
  }

  /**
   * Login to Airwallex and get bearer token
   */
  async login(): Promise<void> {
    try {
      const response = await axios.post<AirwallexLoginResponse>(
        `${this.baseUrl}/api/v1/authentication/login`,
        {},
        {
          headers: {
            "x-client-id": this.clientId,
            "x-api-key": this.apiKey,
            "Content-Type": "application/json",
          },
          timeout: 10000,
        }
      )

      this.bearerToken = response.data.token
      this.tokenExpiresAt = new Date(response.data.expires_at)

      this.logger.info(
        `[Airwallex] Successfully authenticated, token expires at ${this.tokenExpiresAt.toISOString()}`
      )
    } catch (error: any) {
      this.logger.error(
        `[Airwallex] Authentication failed: ${error.message || error.response?.data?.message}`
      )
      throw new Error(
        `Airwallex authentication failed: ${error.message || error.response?.data?.message}`
      )
    }
  }

  /**
   * Build authorization headers including x-on-behalf-of for org-level keys
   */
  private authHeaders(contentType = true): Record<string, string> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.bearerToken}`,
    }
    if (contentType) {
      headers["Content-Type"] = "application/json"
    }
    if (this.accountId) {
      headers["x-on-behalf-of"] = this.accountId
    }
    return headers
  }

  /**
   * Generate a unique request_id (required by Airwallex for all POST requests)
   */
  private generateRequestId(): string {
    return crypto.randomUUID()
  }

  /**
   * Ensure valid token before each request
   */
  private async ensureToken(): Promise<void> {
    if (!this.bearerToken || !this.tokenExpiresAt) {
      await this.login()
      return
    }

    const now = new Date()
    const bufferMs = 60000 // Refresh 1 minute before expiry
    if (now.getTime() + bufferMs >= this.tokenExpiresAt.getTime()) {
      await this.login()
    }
  }

  /**
   * Create a payment intent
   */
  async createPaymentIntent(
    data: AirwallexPaymentIntentRequest
  ): Promise<AirwallexPaymentIntentResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.post<AirwallexPaymentIntentResponse>(
        "/api/v1/pa/payment_intents/create",
        { ...data, request_id: this.generateRequestId() },
        { headers: this.authHeaders() }
      )

      this.logger.info(
        `[Airwallex] Payment intent created: ${response.data.id}`
      )
      return response.data
    } catch (error: any) {
      const respData = error.response?.data
      const message = respData?.message || error.message
      const details = respData ? JSON.stringify(respData) : `status=${error.response?.status}`
      this.logger.error(`[Airwallex] Create payment intent failed: ${message} | details: ${details}`)
      throw new Error(`Failed to create payment intent: ${message}`)
    }
  }

  /**
   * Confirm a payment intent with payment method
   */
  async confirmPaymentIntent(
    intentId: string,
    data: AirwallexConfirmRequest
  ): Promise<AirwallexPaymentIntentResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.post<AirwallexPaymentIntentResponse>(
        `/api/v1/pa/payment_intents/${intentId}/confirm`,
        { ...data, request_id: this.generateRequestId() },
        { headers: this.authHeaders() }
      )

      this.logger.info(
        `[Airwallex] Payment intent confirmed: ${response.data.id}`
      )
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Confirm payment intent failed: ${message}`)
      throw new Error(`Failed to confirm payment intent: ${message}`)
    }
  }

  /**
   * Get payment intent details
   */
  async getPaymentIntent(
    intentId: string
  ): Promise<AirwallexPaymentIntentResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.get<AirwallexPaymentIntentResponse>(
        `/api/v1/pa/payment_intents/${intentId}`,
        { headers: this.authHeaders(false) }
      )

      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(
        `[Airwallex] Get payment intent failed: ${message}`
      )
      throw new Error(`Failed to retrieve payment intent: ${message}`)
    }
  }

  /**
   * Capture a payment intent
   */
  async capturePaymentIntent(
    intentId: string,
    data: AirwallexCaptureRequest = {}
  ): Promise<AirwallexPaymentIntentResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.post<AirwallexPaymentIntentResponse>(
        `/api/v1/pa/payment_intents/${intentId}/capture`,
        { ...data, request_id: this.generateRequestId() },
        { headers: this.authHeaders() }
      )

      this.logger.info(
        `[Airwallex] Payment intent captured: ${response.data.id}`
      )
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Capture payment intent failed: ${message}`)
      throw new Error(`Failed to capture payment intent: ${message}`)
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(intentId: string): Promise<void> {
    await this.ensureToken()

    try {
      await this.client.post(
        `/api/v1/pa/payment_intents/${intentId}/cancel`,
        { request_id: this.generateRequestId() },
        { headers: this.authHeaders() }
      )

      this.logger.info(`[Airwallex] Payment intent cancelled: ${intentId}`)
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Cancel payment intent failed: ${message}`)
      throw new Error(`Failed to cancel payment intent: ${message}`)
    }
  }

  /**
   * Create a refund
   */
  async createRefund(
    data: AirwallexRefundRequest
  ): Promise<AirwallexRefundResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.post<AirwallexRefundResponse>(
        "/api/v1/pa/refunds/create",
        { ...data, request_id: this.generateRequestId() },
        { headers: this.authHeaders() }
      )

      this.logger.info(
        `[Airwallex] Refund created: ${response.data.id}`
      )
      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Create refund failed: ${message}`)
      throw new Error(`Failed to create refund: ${message}`)
    }
  }

  /**
   * Get refund details
   */
  async getRefund(refundId: string): Promise<AirwallexRefundResponse> {
    await this.ensureToken()

    try {
      const response = await this.client.get<AirwallexRefundResponse>(
        `/api/v1/pa/refunds/${refundId}`,
        { headers: this.authHeaders(false) }
      )

      return response.data
    } catch (error: any) {
      const message = error.response?.data?.message || error.message
      this.logger.error(`[Airwallex] Get refund failed: ${message}`)
      throw new Error(`Failed to retrieve refund: ${message}`)
    }
  }
}
