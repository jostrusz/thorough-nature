// @ts-nocheck
import axios, { AxiosInstance } from "axios"
import crypto from "crypto"

export interface IKlarnaOrderLine {
  type?: string // "physical", "digital", "shipping_fee", "discount"
  reference?: string
  name: string
  quantity: number
  quantity_unit?: string
  unit_price: number // in minor units (cents)
  tax_rate: number // as integer, e.g., 2500 = 25%
  total_amount: number // in minor units
  total_tax_amount: number
  total_discount_amount?: number
}

export interface IKlarnaSessionData {
  purchase_country: string
  purchase_currency: string
  locale: string
  order_amount: number // in minor units
  order_tax_amount: number
  order_lines: IKlarnaOrderLine[]
  merchant_urls?: {
    terms?: string
    checkout?: string
    confirmation?: string
    push?: string
  }
  customer?: {
    type?: string // "person" or "organization"
    date_of_birth?: string
  }
  billing_address?: IKlarnaAddress
  shipping_address?: IKlarnaAddress
}

export interface IKlarnaAddress {
  given_name?: string
  family_name?: string
  email?: string
  phone?: string
  title?: string
  street_address: string
  street_address2?: string
  postal_code: string
  city: string
  region?: string
  country: string
  organization_name?: string
}

export interface IKlarnaOrderData {
  authorization_token: string
  purchase_country: string // e.g. "NL"
  purchase_currency: string // e.g. "EUR"
  order_amount: number // in minor units
  order_tax_amount: number
  description?: string
  merchant_reference?: string
  merchant_reference1?: string
  order_lines: IKlarnaOrderLine[]
}

export interface IKlarnaCaptureData {
  captured_amount: number // in minor units
  description?: string
  order_lines?: IKlarnaOrderLine[]
  shipping_info?: Array<{
    shipping_company?: string
    shipping_method?: string
    tracking_number?: string
    tracking_uri?: string
    return_shipping_company?: string
    return_tracking_number?: string
    return_tracking_uri?: string
  }>
}

export interface IKlarnaRefundData {
  refunded_amount: number // in minor units
  reason?: string
  description?: string
  order_lines?: IKlarnaOrderLine[]
}

export interface IKlarnaShippingInfoData {
  shipping_company?: string
  shipping_method?: string
  tracking_number?: string
  tracking_uri?: string
  return_shipping_company?: string
  return_tracking_number?: string
  return_tracking_uri?: string
}

export class KlarnaApiClient {
  private client: AxiosInstance
  private username: string
  private password: string
  private testMode: boolean

  constructor(username: string, password: string, testMode: boolean = true) {
    this.username = username
    this.password = password
    this.testMode = testMode

    const baseURL = testMode
      ? "https://api.playground.klarna.com"
      : "https://api.klarna.com"

    // HTTP Basic Auth with username:password
    const basicAuth = Buffer.from(`${username}:${password}`).toString("base64")

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
   * Create a Klarna payment session
   * Returns a client_token for the frontend widget
   */
  async createSession(sessionData: IKlarnaSessionData): Promise<{
    success: boolean
    data?: {
      session_id?: string
      client_token?: string
      payment_method_categories?: any[]
    }
    error?: string
  }> {
    try {
      const response = await this.client.post("/payments/v1/sessions", sessionData)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to create session",
      }
    }
  }

  /**
   * Create an order after customer authorizes
   */
  async createOrder(orderData: IKlarnaOrderData): Promise<{
    success: boolean
    data?: {
      order_id?: string
      status?: string
      fraud_status?: string
    }
    error?: string
  }> {
    try {
      const authToken = orderData.authorization_token
      const payload = {
        purchase_country: orderData.purchase_country,
        purchase_currency: orderData.purchase_currency,
        order_amount: orderData.order_amount,
        order_tax_amount: orderData.order_tax_amount,
        description: orderData.description,
        merchant_reference: orderData.merchant_reference,
        merchant_reference1: orderData.merchant_reference1,
        order_lines: orderData.order_lines,
      }

      const response = await this.client.post(
        `/payments/v1/authorizations/${authToken}/order`,
        payload
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to create order",
      }
    }
  }

  /**
   * Capture order after shipment
   * Use idempotency key to ensure idempotent requests
   */
  async captureOrder(
    orderId: string,
    captureData: IKlarnaCaptureData,
    idempotencyKey?: string
  ): Promise<{
    success: boolean
    data?: {
      capture_id?: string
      status?: string
    }
    error?: string
  }> {
    try {
      const key = idempotencyKey || crypto.randomUUID()

      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/captures`,
        captureData,
        {
          headers: {
            "Klarna-Idempotency-Key": key,
          },
        }
      )

      // Extract capture_id from Location header (Klarna returns 201 with Location)
      let captureId: string | undefined
      const locationHeader = response.headers?.location || response.headers?.Location
      if (locationHeader) {
        const match = locationHeader.match(/captures\/([^\/\s]+)/)
        if (match) captureId = match[1]
      }

      return {
        success: true,
        data: {
          capture_id: captureId || response.data?.capture_id,
          status: response.data?.status || "captured",
          ...response.data,
        },
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to capture order",
      }
    }
  }

  /**
   * Add shipping info to a capture (can be called after capture)
   */
  async addShippingInfo(
    orderId: string,
    captureId: string,
    shippingInfo: IKlarnaShippingInfoData
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/captures/${captureId}/shipping-info`,
        shippingInfo
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to add shipping info",
      }
    }
  }

  /**
   * Refund an order
   */
  async refundOrder(
    orderId: string,
    refundData: IKlarnaRefundData,
    idempotencyKey?: string
  ): Promise<{
    success: boolean
    data?: {
      refund_id?: string
      status?: string
    }
    error?: string
  }> {
    try {
      const key = idempotencyKey || crypto.randomUUID()

      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/refunds`,
        refundData,
        {
          headers: {
            "Klarna-Idempotency-Key": key,
          },
        }
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to create refund",
      }
    }
  }

  /**
   * Get order details
   */
  async getOrder(orderId: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get(`/ordermanagement/v1/orders/${orderId}`)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to get order",
      }
    }
  }

  /**
   * Release remaining authorization (partial authorization only)
   */
  async releaseAuthorization(orderId: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/release-remaining-authorization`,
        {}
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to release authorization",
      }
    }
  }

  /**
   * Update order amount (for updates before capture)
   */
  async updateAmount(
    orderId: string,
    data: {
      order_amount: number
      order_tax_amount: number
      order_lines: IKlarnaOrderLine[]
    }
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/ordermanagement/v1/orders/${orderId}/amount-updates`,
        data
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.error_messages?.[0] ||
          error.response?.data?.message ||
          error.message ||
          "Failed to update amount",
      }
    }
  }
}
