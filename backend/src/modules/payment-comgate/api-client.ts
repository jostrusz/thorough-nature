// @ts-nocheck
import axios, { AxiosInstance } from "axios"

export interface IComgatePaymentParams {
  merchant: string
  price: number // in haléře/cents (55000 = 550.00 CZK)
  curr: string // EUR, CZK, etc.
  label: string // max 16 chars descriptor
  refId: string // merchant reference ID
  method?: string // bank transfer method or "ALL"
  prepareOnly?: boolean // if true, don't redirect, return transId + URL
  secret: string
  email?: string
  name?: string // payer full name
  lang?: string // gateway UI language: cs, en, sk, pl, etc.
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
      // Force text response — Comgate returns application/x-www-form-urlencoded
      // Without this, axios may try to auto-parse as JSON
      responseType: "text",
      // Don't follow redirects — we need the form-encoded body, not a redirect target
      maxRedirects: 0,
      // Accept all 2xx and 3xx status codes without throwing
      validateStatus: (status) => status >= 200 && status < 400,
    })
  }

  /**
   * Parse form-encoded response from Comgate.
   * Uses URLSearchParams which correctly handles:
   *   - "+" as space (standard form encoding)
   *   - URL-encoded values (%3D, %26, etc.)
   *   - Multiple "=" in values
   * Falls back to manual parsing if data is not a string.
   */
  private parseResponse(data: any): Record<string, any> {
    // If data is already an object (axios auto-parsed JSON), return as-is
    if (typeof data === "object" && data !== null) {
      return data
    }

    // Convert to string if needed
    const str = String(data || "")

    // Use URLSearchParams for robust parsing
    const params = new URLSearchParams(str)
    const result: Record<string, any> = {}
    for (const [key, value] of params.entries()) {
      result[key] = value
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

      // Optional: payer name (shown in Comgate admin)
      if (params.name) {
        formData.append("name", params.name)
      }

      // Optional: payment gateway UI language (cs, en, sk, pl...)
      if (params.lang) {
        formData.append("lang", params.lang)
      }

      console.log(`[Comgate] Sending create request with params: merchant=${params.merchant}, price=${params.price}, curr=${params.curr}, method=${params.method}, prepareOnly=${params.prepareOnly}`)

      const response = await this.client.post(
        "/v1.0/create",
        formData.toString(),
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      )

      // Debug: log raw response
      console.log(`[Comgate] Response status: ${response.status}`)
      console.log(`[Comgate] Response content-type: ${response.headers?.['content-type']}`)
      console.log(`[Comgate] Raw response data type: ${typeof response.data}`)
      console.log(`[Comgate] Raw response data: ${String(response.data).substring(0, 500)}`)

      // Check for redirect response (302/301)
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers?.location
        console.log(`[Comgate] Redirect response, location: ${location}`)
        if (location) {
          // Extract transId from redirect URL if possible
          const urlMatch = location.match(/[?&]id=([^&]+)/) || location.match(/\/([A-Z0-9-]+)$/)
          return {
            success: true,
            data: {
              transId: urlMatch?.[1] || "",
              redirectUrl: location,
              code: "0",
            },
          }
        }
      }

      // Parse form-encoded response
      const parsed = this.parseResponse(response.data)
      console.log(`[Comgate] Parsed response: ${JSON.stringify(parsed)}`)

      if (parsed.code === "0") {
        // Success — Comgate uses "redirect" field name in v1.0 API
        const redirectUrl = parsed.redirect || parsed.redirectUrl || ""
        return {
          success: true,
          data: {
            transId: parsed.transId,
            redirectUrl: redirectUrl,
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
          const errParsed = this.parseResponse(error.response.data)
          errorDetail = ` (Comgate: code=${errParsed.code}, msg=${errParsed.message})`
        } catch {}
      }
      console.error(`[Comgate] createPayment exception: status=${error.response?.status}, data=${String(error.response?.data).substring(0, 300)}, message=${error.message}`)
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

      const response = await this.client.post("/v1.0/status", formData.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      const parsed = this.parseResponse(response.data)

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

      const response = await this.client.post("/v1.0/refund", formData.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      const parsed = this.parseResponse(response.data)

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
   * Requires merchant + secret authentication
   */
  async getMethods(params?: IComgateMethodsParams): Promise<{
    success: boolean
    data?: any
    error?: string
  }> {
    try {
      const formData = new URLSearchParams({
        merchant: this.merchantId,
        secret: this.secret,
        type: "json",
        lang: "cs",
      })
      if (params?.country) formData.append("country", params.country)
      if (params?.curr) formData.append("curr", params.curr)

      const response = await this.client.post("/v1.0/methods", formData.toString(), {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      })

      // Try to parse as JSON
      let data = response.data
      if (typeof data === "string") {
        try { data = JSON.parse(data) } catch { /* keep as string */ }
      }

      return {
        success: true,
        data,
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
