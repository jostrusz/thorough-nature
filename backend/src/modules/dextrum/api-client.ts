/**
 * mySTOCK WMS REST API Client
 *
 * Base URL: customer-specific (e.g. https://customer.mystock.cz)
 * Auth: HTTP Basic
 * All responses: { data: {...}, errors: [...] }
 */

interface MyStockResponse<T = any> {
  data: T
  errors: Array<{ code: string; message: string }>
}

interface MyStockConfig {
  apiUrl: string
  username: string
  password: string
}

export class MyStockApiClient {
  private config: MyStockConfig

  constructor(config: MyStockConfig) {
    this.config = config
  }

  private get authHeader(): string {
    return "Basic " + Buffer.from(`${this.config.username}:${this.config.password}`).toString("base64")
  }

  private get baseUrl(): string {
    return this.config.apiUrl.replace(/\/$/, "")
  }

  async request<T = any>(
    method: "GET" | "POST" | "PUT" | "DELETE",
    path: string,
    body?: any
  ): Promise<MyStockResponse<T>> {
    const url = `${this.baseUrl}/V1${path}`

    const headers: Record<string, string> = {
      Authorization: this.authHeader,
      "Content-Type": "application/json",
      Accept: "application/json",
    }

    const options: RequestInit = { method, headers }
    if (body && (method === "POST" || method === "PUT")) {
      options.body = JSON.stringify(body)
    }

    const response = await fetch(url, options)

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`mySTOCK API ${method} ${path} failed: ${response.status} ${response.statusText} - ${text}`)
    }

    return response.json()
  }

  // ═══════════════════════════════════════════
  // CONNECTION TEST
  // ═══════════════════════════════════════════
  async testConnection(): Promise<{ ok: boolean; message: string }> {
    try {
      const result = await this.request("GET", "/aboutMe/")
      if (result.errors?.length) {
        return { ok: false, message: result.errors[0].message }
      }
      return { ok: true, message: "Connected successfully" }
    } catch (error: any) {
      return { ok: false, message: error.message }
    }
  }

  // ═══════════════════════════════════════════
  // ORDER INCOMING — Send order to WMS
  // ═══════════════════════════════════════════
  async createOrder(payload: {
    orderCode: string
    operatingUnitId: string
    partnerId: string
    deliveryMethodId?: string
    paymentMethodId?: string
    orderItems: Array<{
      productCode: string
      quantity: number
      unitPrice?: number
      productName?: string
    }>
    deliveryAddress: {
      name: string
      street: string
      city: string
      zip: string
      countryCode: string
      phone?: string
      email?: string
    }
    cashAmount?: number
    note?: string
  }): Promise<{ id: string }> {
    const body: any = {
      orderCode: payload.orderCode,
      operatingUnitId: payload.operatingUnitId,
      partnerId: payload.partnerId,
      orderItems: payload.orderItems.map((item, i) => ({
        lineNumber: i + 1,
        productCode: item.productCode,
        quantityOrdered: item.quantity,
        unitPrice: item.unitPrice || 0,
        productName: item.productName || "",
      })),
      deliveryAddress: {
        name: payload.deliveryAddress.name,
        street: payload.deliveryAddress.street,
        city: payload.deliveryAddress.city,
        zipCode: payload.deliveryAddress.zip,
        countryCode: payload.deliveryAddress.countryCode,
        phone: payload.deliveryAddress.phone || "",
        email: payload.deliveryAddress.email || "",
      },
    }

    if (payload.deliveryMethodId) {
      body.deliveryMethodId = payload.deliveryMethodId
    }
    if (payload.paymentMethodId) {
      body.paymentMethodId = payload.paymentMethodId
    }
    if (payload.cashAmount !== undefined) {
      body.paymentInformation = { cashAmount: payload.cashAmount }
    }
    if (payload.note) {
      body.note = payload.note
    }

    const result = await this.request<{ id: string }>("POST", "/orderIncoming/", body)
    return result.data
  }

  // ═══════════════════════════════════════════
  // GET ORDER STATUS — Poll order from WMS
  // ═══════════════════════════════════════════
  async getOrder(orderId: string): Promise<any> {
    const result = await this.request("GET", `/orderIncoming/${orderId}`)
    return result.data
  }

  // ═══════════════════════════════════════════
  // STOCK CARD — Get inventory levels
  // ═══════════════════════════════════════════
  async getStockCard(warehouseCode: string, productCode?: string): Promise<any[]> {
    let path = `/stockCard/${warehouseCode}/`
    if (productCode) {
      path += `?productCode=${encodeURIComponent(productCode)}`
    }
    const result = await this.request("GET", path)
    return Array.isArray(result.data) ? result.data : [result.data]
  }

  // ═══════════════════════════════════════════
  // CANCEL ORDER
  // ═══════════════════════════════════════════
  async cancelOrder(orderId: string): Promise<void> {
    await this.request("DELETE", `/orderIncoming/${orderId}`)
  }

  // ═══════════════════════════════════════════
  // GET DESPATCH ADVICE (shipment tracking)
  // ═══════════════════════════════════════════
  async getDespatchAdvice(documentId: string): Promise<any> {
    const result = await this.request("GET", `/despatchAdvice/${documentId}`)
    return result.data
  }
}
