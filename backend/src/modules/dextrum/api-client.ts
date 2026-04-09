/**
 * mySTOCK WMS REST API Client
 *
 * Base URL: customer-specific (e.g. https://customer.mystock.cz)
 * Auth: HTTP Basic
 * All responses: { data: {...}, errors: [...] }
 */

import { fetch as undiciFetch, Agent } from "undici"
import { readFileSync } from "fs"
import { join } from "path"

// Load Kvados Root CA certificates (Dextrum/mySTOCK uses Kvados CA)
let kvadosCaCerts: string
try {
  const ca1 = readFileSync(join(__dirname, "certs", "kvados-root-ca.pem"), "utf-8")
  const ca2 = readFileSync(join(__dirname, "certs", "kvados-root-ca-g2.pem"), "utf-8")
  kvadosCaCerts = ca1 + "\n" + ca2
} catch {
  // Fallback: if cert files not found, we'll use rejectUnauthorized: false
  kvadosCaCerts = ""
}

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
  private agent: Agent

  constructor(config: MyStockConfig) {
    this.config = config
    // Configure TLS to trust Kvados Root CA (used by Dextrum/mySTOCK servers)
    this.agent = new Agent({
      connect: kvadosCaCerts
        ? { ca: kvadosCaCerts }
        : { rejectUnauthorized: false },
    })
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

    const fetchOptions: any = {
      method,
      headers,
      dispatcher: this.agent,
    }

    if (body && (method === "POST" || method === "PUT")) {
      fetchOptions.body = JSON.stringify(body)
    }

    const response = await undiciFetch(url, fetchOptions)

    if (!response.ok) {
      const text = await response.text().catch(() => "")
      throw new Error(`mySTOCK API ${method} ${path} failed: ${response.status} ${response.statusText} - ${text}`)
    }

    return response.json() as Promise<MyStockResponse<T>>
  }

  // ═══════════════════════════════════════════
  // CONNECTION TEST
  // ═══════════════════════════════════════════
  async aboutMe(): Promise<any> {
    const result = await this.request("GET", "/aboutMe/")
    return result.data
  }

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
    warehouseCode?: string
    operatingUnitId?: string
    partnerId: string
    deliveryMethodId?: string
    paymentMethodId?: string
    orderItems: Array<{
      productCode: string
      quantity: number
      productName?: string
    }>
    deliveryAddress: {
      firstName: string
      lastName: string
      company?: string
      street: string
      city: string
      zip: string
      country: string
      phone?: string
      email?: string
      pickupPlaceCode?: string
      externalCarrierCode?: string
    }
    cashAmount?: number
    cashCurrencyCode?: string
    note?: string
  }): Promise<{ id: string }> {
    const body: any = {
      orderCode: payload.orderCode,
      extIsId: payload.orderCode, // unique ERP identifier
      type: 1, // External order
      partnerId: payload.partnerId,
      items: payload.orderItems.map((item, i) => ({
        itemCode: `${payload.orderCode}/${String(i + 1).padStart(3, "0")}`,
        extIsId: `${payload.orderCode}/${String(i + 1).padStart(3, "0")}`,
        productId: item.productCode, // ext. system code (SKU)
        amount: {
          quantity: item.quantity,
        },
        warehouseCode: payload.warehouseCode || undefined,
        name: item.productName || undefined,
      })),
      partyIdentification: {
        firstName: payload.deliveryAddress.firstName,
        lastName: payload.deliveryAddress.lastName,
        street: payload.deliveryAddress.street,
        city: payload.deliveryAddress.city,
        zip: payload.deliveryAddress.zip,
        country: payload.deliveryAddress.country,
        phone: payload.deliveryAddress.phone || "",
        email: payload.deliveryAddress.email || "",
      },
    }

    if (payload.warehouseCode) {
      body.warehouseCode = payload.warehouseCode
    }
    if (payload.operatingUnitId) {
      body.operatingUnitId = payload.operatingUnitId
    }
    if (payload.deliveryAddress.company) {
      body.partyIdentification.company = payload.deliveryAddress.company
    }
    if (payload.deliveryAddress.pickupPlaceCode) {
      body.partyIdentification.pickupPlaceCode = payload.deliveryAddress.pickupPlaceCode
    }
    if (payload.deliveryAddress.externalCarrierCode) {
      body.partyIdentification.externalCarrierCode = payload.deliveryAddress.externalCarrierCode
    }
    if (payload.deliveryMethodId) {
      body.deliveryMethodId = payload.deliveryMethodId
    }
    if (payload.paymentMethodId) {
      body.paymentMethodId = payload.paymentMethodId
    }
    if (payload.cashAmount !== undefined) {
      body.paymentInformation = {
        cashAmount: payload.cashAmount,
        currencyCode: payload.cashCurrencyCode || "EUR",
        variableSymbol: payload.orderCode,
      }
    }
    if (payload.note) {
      body.note = payload.note
    }

    console.log(`[mySTOCK] createOrder payload:`, JSON.stringify(body, null, 2))
    const result = await this.request<any>("POST", "/orderIncoming/", body)
    console.log(`[mySTOCK] createOrder response:`, JSON.stringify(result.data))
    // Response format: { ids: [{ id: "UUID", type: "orderIncoming", ... }, ...] }
    const orderId = result.data?.ids?.[0]?.id || result.data?.id || null
    return { id: orderId }
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
    const params = new URLSearchParams()
    if (warehouseCode) params.set("warehouseCode", warehouseCode)
    if (productCode) params.set("productCode", productCode)
    const qs = params.toString()
    const path = `/stockCard/${qs ? `?${qs}` : ""}`
    const result = await this.request("GET", path)
    const data = result.data?.result || result.data
    return Array.isArray(data) ? data : [data]
  }

  async getProductStockCard(warehouseCode: string, productCode?: string): Promise<any[]> {
    const params = new URLSearchParams()
    if (warehouseCode) params.set("warehouseCode", warehouseCode)
    if (productCode) params.set("productCode", productCode)
    const qs = params.toString()
    const path = `/productStockCard/${qs ? `?${qs}` : ""}`
    const result = await this.request("GET", path)
    const data = result.data?.result || result.data
    return Array.isArray(data) ? data : [data]
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

  // ═══════════════════════════════════════════
  // CREATE PRODUCT — Register product in WMS
  // ═══════════════════════════════════════════
  async createProduct(payload: {
    productCode: string
    name: string
    type?: number
    measurementUnitCode?: string
    warehouseCode?: string
    weightGross?: number
    weightNett?: number
  }): Promise<any> {
    const body: any = {
      productCode: payload.productCode,
      extIsId: payload.productCode,
      name: payload.name,
      type: payload.type ?? 0, // 0 = Goods
      measurementUnitCode: payload.measurementUnitCode || "ks",
    }
    if (payload.warehouseCode) body.warehouseCode = payload.warehouseCode
    if (payload.weightGross) body.weightGross = payload.weightGross
    if (payload.weightNett) body.weightNett = payload.weightNett

    console.log(`[mySTOCK] createProduct payload:`, JSON.stringify(body, null, 2))
    const result = await this.request("POST", "/product/", body)
    return result.data
  }

  // ═══════════════════════════════════════════
  // UPDATE PRODUCT
  // ═══════════════════════════════════════════
  async updateProduct(productId: string, payload: {
    warehouseCode?: string
    name?: string
  }): Promise<any> {
    const body: any = {}
    if (payload.warehouseCode) body.warehouseCode = payload.warehouseCode
    if (payload.name) body.name = payload.name

    console.log(`[mySTOCK] updateProduct ${productId} payload:`, JSON.stringify(body, null, 2))
    const result = await this.request("PUT", `/product/${productId}`, body)
    return result.data
  }

  // ═══════════════════════════════════════════
  // CREATE RECEIPT — Add stock to warehouse
  // ═══════════════════════════════════════════
  async createReceipt(payload: {
    receiptCode: string
    type?: number
    warehouseCode?: string
    partnerId?: string
    receiptDate: string
    items: Array<{
      productId: string
      quantity: number
      itemCode?: string
    }>
  }): Promise<any> {
    const body: any = {
      receiptCode: payload.receiptCode,
      extIsId: payload.receiptCode,
      type: payload.type ?? 1, // 1 = External receipt
      receiptDate: payload.receiptDate,
      items: payload.items.map((item, i) => ({
        itemCode: item.itemCode || `${payload.receiptCode}/${String(i + 1).padStart(3, "0")}`,
        extIsId: item.itemCode || `${payload.receiptCode}/${String(i + 1).padStart(3, "0")}`,
        productId: item.productId,
        amount: {
          quantity: item.quantity,
        },
        qualityControlStatus: 30, // Blocked (no QC needed)
      })),
    }
    if (payload.warehouseCode) {
      body.warehouseCode = payload.warehouseCode
      body.items.forEach((item: any) => { item.warehouseCode = payload.warehouseCode })
    }
    if (payload.partnerId) body.partnerId = payload.partnerId

    console.log(`[mySTOCK] createReceipt payload:`, JSON.stringify(body, null, 2))
    const result = await this.request("POST", "/receipt/", body)
    return result.data
  }
}
