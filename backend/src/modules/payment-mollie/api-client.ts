// @ts-nocheck
import axios, { AxiosInstance } from "axios"

export interface IMollieOrderData {
  amount: {
    value: string
    currency: string
  }
  orderNumber: string
  lines: Array<{
    type?: string
    sku?: string
    name: string
    quantity: number
    unitPrice: {
      value: string
      currency: string
    }
    totalAmount: {
      value: string
      currency: string
    }
    vatRate?: string
    vatAmount?: {
      value: string
      currency: string
    }
  }>
  billingAddress?: {
    organizationName?: string
    streetAndNumber: string
    postalCode: string
    city: string
    country: string
    title?: string
    givenName?: string
    familyName?: string
    email?: string
    phone?: string
  }
  shippingAddress?: {
    organizationName?: string
    streetAndNumber: string
    postalCode: string
    city: string
    country: string
    title?: string
    givenName?: string
    familyName?: string
    email?: string
    phone?: string
  }
  description?: string
  redirectUrl: string
  webhookUrl: string
  method?: string | string[]
  locale?: string
  metadata?: Record<string, any>
  payment?: {
    issuer?: string
    customerId?: string
    mandateId?: string
    sequenceType?: string
  }
}

export interface IMollieShipmentData {
  lines?: Array<{
    id: string
    quantity?: number
  }>
  tracking?: {
    carrier: string
    code: string
    url?: string
  }
}

export interface IMollieRefundData {
  lines?: Array<{
    id: string
    quantity?: number
  }>
  description?: string
  metadata?: Record<string, any>
}

export interface IMolliePaymentData {
  amount: {
    value: string
    currency: string
  }
  description: string
  redirectUrl: string
  webhookUrl: string
  method?: string
  cardToken?: string
  customerId?: string
  mandateId?: string
  sequenceType?: string
  firstPaymentDescription?: string
  metadata?: Record<string, any>
}

export interface IMollieMethodsParams {
  locale?: string
  includeWallets?: boolean
  resourceId?: string
}

export class MollieApiClient {
  private client: AxiosInstance
  private apiKey: string
  private testMode: boolean

  constructor(apiKey: string, testMode: boolean = true) {
    this.apiKey = apiKey
    this.testMode = testMode

    this.client = axios.create({
      baseURL: "https://api.mollie.com/v2",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    })
  }

  /**
   * Create a Mollie order
   */
  async createOrder(orderData: IMollieOrderData): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post("/orders", orderData)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Get a Mollie order by ID
   */
  async getOrder(mollieOrderId: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get(`/orders/${mollieOrderId}`)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a shipment for a Mollie order (with tracking info)
   */
  async createShipment(
    orderId: string,
    shipmentData: IMollieShipmentData
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/orders/${orderId}/shipments`,
        shipmentData
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a payment (for recurring/upsell)
   */
  async createPayment(paymentData: IMolliePaymentData): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post("/payments", paymentData)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Get a payment by ID
   */
  async getPayment(paymentId: string): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get(`/payments/${paymentId}`)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a refund for a Mollie order
   */
  async createRefund(
    orderId: string,
    refundData: IMollieRefundData
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/orders/${orderId}/refunds`,
        refundData
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Refund a Mollie payment (Payments API - for tr_ IDs)
   */
  async refundPayment(
    paymentId: string,
    refundData: { amount: { value: string; currency: string }; description?: string }
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/payments/${paymentId}/refunds`,
        refundData
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Refund a Mollie order (Orders API - for ord_ IDs)
   */
  async refundOrder(
    orderId: string,
    refundData: { amount?: { value: string; currency: string }; description?: string; lines?: any[] }
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.post(
        `/orders/${orderId}/refunds`,
        refundData
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * List available payment methods
   */
  async listMethods(params?: IMollieMethodsParams): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get("/methods", { params })
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a first payment (for mandate creation - one-click upsell)
   */
  async createFirstPayment(
    customerId: string,
    paymentData: IMolliePaymentData
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const payloadWithCustomer = {
        ...paymentData,
        customerId,
        sequenceType: "first",
      }
      const response = await this.client.post("/payments", payloadWithCustomer)
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }

  /**
   * Create a recurring payment using a mandate (upsell charge)
   */
  async createRecurringPayment(
    customerId: string,
    mandateId: string,
    paymentData: Omit<IMolliePaymentData, "customerId" | "mandateId">
  ): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const payloadWithMandate = {
        ...paymentData,
        customerId,
        mandateId,
        sequenceType: "recurring",
      }
      const response = await this.client.post(
        "/payments",
        payloadWithMandate
      )
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          error.message,
      }
    }
  }
}
