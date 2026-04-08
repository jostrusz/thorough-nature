import axios, { AxiosInstance } from "axios"

interface PayPalTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

export interface IPayPalOrderData {
  intent: "AUTHORIZE" | "CAPTURE"
  purchase_units: Array<{
    reference_id?: string
    amount: {
      currency_code: string
      value: string
      breakdown?: {
        item_total?: { currency_code: string; value: string }
        tax_total?: { currency_code: string; value: string }
        shipping?: { currency_code: string; value: string }
        discount?: { currency_code: string; value: string }
      }
    }
    items?: Array<{
      name: string
      unit_amount: { currency_code: string; value: string }
      tax?: { currency_code: string; value: string }
      quantity: string
      category?: "PHYSICAL_GOODS" | "DIGITAL_GOODS"
    }>
    shipping?: {
      name?: { full_name: string }
      address?: {
        address_line_1: string
        address_line_2?: string
        admin_area_2: string
        admin_area_1?: string
        postal_code: string
        country_code: string
      }
    }
  }>
  payment_source?: {
    paypal?: {
      experience_context?: {
        payment_method_preference?: string
        brand_name?: string
        locale?: string
        landing_page?: string
        user_action?: string
        return_url?: string
        cancel_url?: string
      }
    }
    ideal?: {
      country_code: string
      name: string
      experience_context?: {
        payment_method_preference?: string
        return_url?: string
        cancel_url?: string
      }
    }
    bancontact?: {
      country_code: string
      name: string
      experience_context?: {
        payment_method_preference?: string
        return_url?: string
        cancel_url?: string
      }
    }
    blik?: {
      country_code: string
      name: string
      email?: string
      experience_context?: {
        payment_method_preference?: string
        return_url?: string
        cancel_url?: string
      }
    }
    p24?: {
      country_code: string
      name: string
      email: string
      experience_context?: {
        payment_method_preference?: string
        return_url?: string
        cancel_url?: string
      }
    }
    eps?: {
      country_code: string
      name: string
      experience_context?: {
        payment_method_preference?: string
        return_url?: string
        cancel_url?: string
      }
    }
    swish?: {
      country_code: string
      experience_context?: {
        payment_method_preference?: string
        return_url?: string
        cancel_url?: string
      }
    }
    card?: {
      experience_context?: {
        payment_method_preference?: string
        return_url?: string
        cancel_url?: string
      }
    }
  }
  processing_instruction?: string
}

/**
 * PayPal REST API v2 Client
 *
 * Handles OAuth 2.0 token management and all PayPal API calls.
 * Base URLs: sandbox = api-m.sandbox.paypal.com, live = api-m.paypal.com
 * Amounts: STRING format ("29.99"), NOT integer minor units.
 */
export class PayPalApiClient {
  private httpClient: AxiosInstance
  private clientId: string
  private clientSecret: string
  private accessToken: string | null = null
  private tokenExpiry: number = 0

  constructor(config: {
    client_id: string
    client_secret: string
    mode: "live" | "test"
  }) {
    this.clientId = config.client_id
    this.clientSecret = config.client_secret

    const baseURL =
      config.mode === "live"
        ? "https://api-m.paypal.com"
        : "https://api-m.sandbox.paypal.com"

    this.httpClient = axios.create({ baseURL, timeout: 30000 })
  }

  /**
   * Get or refresh OAuth 2.0 access token
   */
  private async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken
    }

    const response = await this.httpClient.post<PayPalTokenResponse>(
      "/v1/oauth2/token",
      "grant_type=client_credentials",
      {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        auth: { username: this.clientId, password: this.clientSecret },
      }
    )

    this.accessToken = response.data.access_token
    // Subtract 60s buffer to avoid using expired tokens
    this.tokenExpiry = Date.now() + (response.data.expires_in - 60) * 1000
    return this.accessToken
  }

  private async authHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken()
    return {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    }
  }

  /**
   * Generate a unique request ID for PayPal idempotency.
   * Required when payment_source is included in create order request.
   */
  private generateRequestId(): string {
    return "pp-" + Date.now() + "-" + Math.random().toString(36).substring(2, 10)
  }

  /**
   * Create a PayPal order (checkout)
   * POST /v2/checkout/orders
   *
   * PayPal-Request-Id header is REQUIRED when payment_source is present
   * (APM methods like iDEAL, Bancontact, etc.)
   */
  async createOrder(data: IPayPalOrderData): Promise<any> {
    const headers: Record<string, string> = {
      ...(await this.authHeaders()),
      "PayPal-Request-Id": this.generateRequestId(),
    }
    const response = await this.httpClient.post(
      "/v2/checkout/orders",
      data,
      { headers }
    )
    return response.data
  }

  /**
   * Authorize an approved order
   * POST /v2/checkout/orders/{order_id}/authorize
   */
  async authorizeOrder(orderId: string): Promise<any> {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post(
      `/v2/checkout/orders/${orderId}/authorize`,
      {},
      { headers }
    )
    return response.data
  }

  /**
   * Capture an order directly (for intent=CAPTURE)
   * POST /v2/checkout/orders/{order_id}/capture
   */
  async captureOrder(orderId: string): Promise<any> {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post(
      `/v2/checkout/orders/${orderId}/capture`,
      {},
      { headers }
    )
    return response.data
  }

  /**
   * Capture an authorized payment
   * POST /v2/payments/authorizations/{authorization_id}/capture
   */
  async captureAuthorization(
    authorizationId: string,
    amount?: { currency_code: string; value: string },
    finalCapture: boolean = true
  ): Promise<any> {
    const headers = await this.authHeaders()
    const body: any = { final_capture: finalCapture }
    if (amount) body.amount = amount
    const response = await this.httpClient.post(
      `/v2/payments/authorizations/${authorizationId}/capture`,
      body,
      { headers }
    )
    return response.data
  }

  /**
   * Refund a captured payment
   * POST /v2/payments/captures/{capture_id}/refund
   *
   * For full refund: pass empty data or omit amount
   * For partial refund: pass { amount: { currency_code, value } }
   */
  async refundCapture(
    captureId: string,
    data?: {
      amount?: { currency_code: string; value: string }
      note_to_payer?: string
    }
  ): Promise<any> {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post(
      `/v2/payments/captures/${captureId}/refund`,
      data || {},
      { headers }
    )
    return response.data
  }

  /**
   * Get order details
   * GET /v2/checkout/orders/{order_id}
   */
  async getOrder(orderId: string): Promise<any> {
    const headers = await this.authHeaders()
    const response = await this.httpClient.get(
      `/v2/checkout/orders/${orderId}`,
      { headers }
    )
    return response.data
  }

  /**
   * Void an authorization (cancel before capture)
   * POST /v2/payments/authorizations/{authorization_id}/void
   */
  async voidAuthorization(authorizationId: string): Promise<any> {
    const headers = await this.authHeaders()
    const response = await this.httpClient.post(
      `/v2/payments/authorizations/${authorizationId}/void`,
      {},
      { headers }
    )
    return response.data
  }

  /**
   * Add tracking info to an order
   * POST /v2/checkout/orders/{order_id}/track
   */
  async addTracking(
    orderId: string,
    captureId: string,
    trackingNumber: string,
    carrier: string,
    notifyPayer: boolean = true,
    carrierNameOther?: string
  ): Promise<any> {
    const headers = await this.authHeaders()
    const body: any = {
      tracking_number: trackingNumber,
      carrier: carrier.toUpperCase(),
      capture_id: captureId,
      notify_payer: notifyPayer,
    }
    if (carrier.toUpperCase() === "OTHER" && carrierNameOther) {
      body.carrier_name_other = carrierNameOther
    }
    const response = await this.httpClient.post(
      `/v2/checkout/orders/${orderId}/track`,
      body,
      { headers }
    )
    return response.data
  }

  /**
   * Verify webhook signature via PayPal API
   * POST /v1/notifications/verify-webhook-signature
   */
  async verifyWebhookSignature(
    webhookId: string,
    reqHeaders: Record<string, string>,
    body: any
  ): Promise<boolean> {
    try {
      const headers = await this.authHeaders()
      const response = await this.httpClient.post(
        "/v1/notifications/verify-webhook-signature",
        {
          auth_algo: reqHeaders["paypal-auth-algo"],
          cert_url: reqHeaders["paypal-cert-url"],
          transmission_id: reqHeaders["paypal-transmission-id"],
          transmission_sig: reqHeaders["paypal-transmission-sig"],
          transmission_time: reqHeaders["paypal-transmission-time"],
          webhook_id: webhookId,
          webhook_event: body,
        },
        { headers }
      )
      return response.data.verification_status === "SUCCESS"
    } catch (err: any) {
      console.error(`[PayPal] Webhook signature verification failed: ${err.message}`)
      return false
    }
  }

  /**
   * Get authorization details
   * GET /v2/payments/authorizations/{authorization_id}
   */
  async getAuthorization(authorizationId: string): Promise<any> {
    const headers = await this.authHeaders()
    const response = await this.httpClient.get(
      `/v2/payments/authorizations/${authorizationId}`,
      { headers }
    )
    return response.data
  }

  /**
   * Get capture details
   * GET /v2/payments/captures/{capture_id}
   */
  async getCapture(captureId: string): Promise<any> {
    const headers = await this.authHeaders()
    const response = await this.httpClient.get(
      `/v2/payments/captures/${captureId}`,
      { headers }
    )
    return response.data
  }
}
