// @ts-nocheck
import axios, { AxiosInstance } from "axios"

export interface IComgatePaymentParams {
  merchant: string
  price: number // in cents
  curr: string // EUR, CZK, etc.
  label: string // max 16 chars descriptor
  refId: string // merchant reference ID
  method?: string // bank transfer method
  prepareOnly?: boolean // if true, don't redirect, return transId + URL
  secret: string
  email?: string
  country?: string
}

export interface IComgateStatusParams {
  merchant: string
  transId: string
  secret: string
}

export interface IComgateRefundParams {
  merchant: string
  transId: string
  amount?: number // in cents, optional (full refund if omitted)
  secret: string
}

export interface IComgateMethodsParams {
  country?: string
  curr?: string
}

export class ComgateApiClient {
  private client: AxiosInstance
  private merchantId: string
  private secret: string

  constructor(merchantId: string, secret: string) {
    this.merchantId = merchantId
    this.secret = secret

    this.client = axios.create({
      baseURL: "https://payments.comgate.cz",
      timeout: 10000,
    })
  }

  /**
   * Parse form-encoded response from Comgate
   */
  private parseFormEncoded(data: string): Record<string, any> {
    const result: Record<string, any> = {}
    const pairs = data.split("&")
    for (const pair of pairs) {
      const [key, value] = pair.split("=")
      result[decodeURIComponent(key)] = decodeURIComponent(value || "")
    }
    return result
  }

  /**
   * Create a payment or payment redirect
   * If prepareOnly=true, returns transId + redirect URL without auto-redirect
   */
  async createPayment(params: IComgatePaymentParams): Promise<{
    success: boolean
    data?: {
      transId?: string
      redirectUrl?: string
      code?: string
      message?: string
    }
    error?: string
  }> {
    try {
      // Build form data
      const formData = new URLSearchParams({
        merchant: params.merchant,
        price: params.price.toString(),
        curr: params.curr,
        label: params.label.substring(0, 16), // enforce max 16 chars
        refId: params.refId,
        secret: params.secret,
        email: params.email || "",
        country: params.country || "",
      })

      if (params.method) {
        formData.append("method", params.method)
      }

      if (params.prepareOnly) {
        formData.append("prepareOnly", "true")
      }

      const response = await this.client.post(
        "/v1.0/create",
        formData,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      )

      // Comgate returns form-encoded response
      const parsed = this.parseFormEncoded(response.data)

      if (parsed.code === "0") {
        // Success
        return {
          success: true,
          data: {
            transId: parsed.transId,
            redirectUrl: parsed.redirect,
            code: parsed.code,
          },
        }
      } else {
        return {
          success: false,
          error: `Comgate error ${parsed.code}: ${parsed.message || "Unknown error"}`,
          data: {
            code: parsed.code,
            message: parsed.message,
          },
        }
      }
    } catch (error: any) {
      // Try to parse Comgate error from response body
      let errorDetail = ""
      if (error.response?.data) {
        try {
          const errParsed = this.parseFormEncoded(error.response.data)
          errorDetail = ` (Comgate: code=${errParsed.code}, msg=${errParsed.message})`
        } catch {}
      }
      return {
        success: false,
        error:
          (error.response?.status ? `HTTP ${error.response.status}: ` : "") +
          (error.message || "Failed to create payment") +
          errorDetail,
      }
    }
  }

  /**
   * Get payment status
   */
  async getStatus(params: IComgateStatusParams): Promise<{
    success: boolean
    data?: {
      transId?: string
      status?: string // PAID, PENDING, CANCELLED, AUTHORIZED, etc.
      price?: number
      curr?: string
      method?: string
      code?: string
      message?: string
    }
    error?: string
  }> {
    try {
      const formData = new URLSearchParams({
        merchant: params.merchant,
        transId: params.transId,
        secret: params.secret,
      })

      const response = await this.client.post("/v1.0/status", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      // Comgate returns form-encoded response
      const parsed = this.parseFormEncoded(response.data)

      if (parsed.code === "0") {
        return {
          success: true,
          data: {
            transId: parsed.transId,
            status: parsed.status,
            price: parsed.price ? parseInt(parsed.price, 10) : undefined,
            curr: parsed.curr,
            method: parsed.method,
            code: parsed.code,
          },
        }
      } else {
        return {
          success: false,
          error: parsed.message || "Status check failed",
          data: {
            code: parsed.code,
            message: parsed.message,
          },
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to check status",
      }
    }
  }

  /**
   * Create a refund
   */
  async createRefund(params: IComgateRefundParams): Promise<{
    success: boolean
    data?: {
      transId?: string
      code?: string
      message?: string
    }
    error?: string
  }> {
    try {
      const formData = new URLSearchParams({
        merchant: params.merchant,
        transId: params.transId,
        secret: params.secret,
      })

      if (params.amount) {
        formData.append("amount", params.amount.toString())
      }

      const response = await this.client.post("/v1.0/refund", formData, {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      // Comgate returns form-encoded response
      const parsed = this.parseFormEncoded(response.data)

      if (parsed.code === "0") {
        return {
          success: true,
          data: {
            transId: parsed.transId,
            code: parsed.code,
          },
        }
      } else {
        return {
          success: false,
          error: parsed.message || "Refund failed",
          data: {
            code: parsed.code,
            message: parsed.message,
          },
        }
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to create refund",
      }
    }
  }

  /**
   * Get available payment methods
   */
  async getMethods(params?: IComgateMethodsParams): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const response = await this.client.get("/v1.0/methods", { params })
      // getMethods may return JSON or form-encoded depending on endpoint version
      return {
        success: true,
        data: response.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error:
          error.response?.data?.message ||
          error.message ||
          "Failed to get methods",
      }
    }
  }
}
