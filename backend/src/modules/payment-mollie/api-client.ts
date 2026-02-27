// @ts-nocheck
import axios, { AxiosInstance } from "axios"

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
   * Create a payment
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
   * Refund a Mollie payment
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
