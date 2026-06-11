// @ts-nocheck
/**
 * Huset (3PLhuset / Fortus International) SOAP API client.
 *
 * Endpoint:  https://integration.3plhuset.com/wms.asmx  (verified via public WSDL)
 * Namespace: http://integration.fortusinternational.com/
 * Protocol:  SOAP 1.2 (matches the sample.xml provided by Christoffer Andersson)
 *
 * Auth is embedded in every request body as an <auth> block
 * (CompanyId, HashKey, IntegrationId, CountryId) — no HTTP-level auth.
 *
 * Request field ORDER follows the provider sample.xml exactly — SOAP sequences
 * are order-sensitive on ASMX when validation is strict.
 */

export type HusetAuth = {
  companyId: string
  hashKey: string
  integrationId: number
  countryId: string
}

export type HusetOrderItem = {
  articleRef: string
  qty: number
}

export type HusetReceiverParams = {
  receiverRef: string
  deliveryName: string
  deliveryStreet: string
  deliveryStreet2?: string
  deliveryPostalCode: string
  deliveryCity: string
  /** ISO 3166-1 alpha-3, e.g. NOR / SWE */
  deliveryCountryId: string
  invoiceName?: string
  invoiceStreet?: string
  invoicePostalCode?: string
  invoiceCity?: string
  invoiceCountryId?: string
  languageId?: string
  cellphone?: string
  email: string
  /** true = private person delivery (Bring B2C) */
  isResidential?: boolean
}

export type HusetCreateOrderParams = {
  orderRef: string
  receiverRef: string
  items: HusetOrderItem[]
  logisticsMethodId: number
  salesOrgId: number
  orderNotes?: string
  /** "Update" creates/updates, "Cancel" cancels the order */
  orderStatusId?: "Update" | "Cancel"
  overrideAddress?: string
  deliveryName: string
  deliveryStreet: string
  deliveryPostalCode: string
  deliveryCity: string
  /** ISO 3166-1 alpha-3, e.g. NOR / SWE */
  deliveryCountryId: string
  invoiceName?: string
  invoiceStreet?: string
  invoicePostalCode?: string
  invoiceCity?: string
  invoiceCountryId?: string
  deliveryEmail: string
  deliveryContactName: string
  deliveryCellphone?: string
  pickupLocationCode?: string
}

export type HusetFreightBooking = {
  logisticsMethodId: number | null
  trackcode1: string
  trackcode2: string
  weight: number | null
  trackingUrl: string
  logisticsProviderDescription: string
  logisticsMethodDescription: string
}

export type HusetOutgoingDelivery = {
  outgoingDeliveryId: number
  outgoingDeliveryOrderId: number
  outgoingDeliveryOrderRef: string
  actualDeliveryTimestamp: string
  isSplitDelivery: boolean
  freightBookings: HusetFreightBooking[]
  rawXml: string
}

const NS = "http://integration.fortusinternational.com/"

function xmlEscape(value: any): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

/** Extract inner text of the first <tag>...</tag> occurrence (namespace-agnostic). */
function tagText(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${tag}>`))
  return m ? m[1].trim() : ""
}

/** Extract all <tag>...</tag> blocks (outer content), namespace-agnostic. */
function tagBlocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:\\w+:)?${tag}(?:\\s[^>]*)?>[\\s\\S]*?</(?:\\w+:)?${tag}>`, "g")
  return xml.match(re) || []
}

function decodeEntities(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

export class HusetApiClient {
  private endpoint: string
  private auth: HusetAuth

  constructor(config: { endpoint: string; auth: HusetAuth }) {
    this.endpoint = config.endpoint
    this.auth = config.auth
  }

  private buildAuthBlock(): string {
    // Field order per WSDL AuthObject sequence (DivsisionId omitted — provider
    // sample omits it and ASMX defaults it).
    return `<int:auth>
      <int:CompanyId>${xmlEscape(this.auth.companyId)}</int:CompanyId>
      <int:HashKey>${xmlEscape(this.auth.hashKey)}</int:HashKey>
      <int:IntegrationId>${this.auth.integrationId}</int:IntegrationId>
      <int:CountryId>${xmlEscape(this.auth.countryId)}</int:CountryId>
    </int:auth>`
  }

  private buildEnvelope(body: string): string {
    return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://www.w3.org/2003/05/soap-envelope" xmlns:int="${NS}">
  <soap:Header/>
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`
  }

  private async call(method: string, innerBody: string): Promise<string> {
    const envelope = this.buildEnvelope(`<int:${method}>${innerBody}</int:${method}>`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    let response: Response
    try {
      response = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          // SOAP 1.2: action is part of the Content-Type header
          "Content-Type": `application/soap+xml; charset=utf-8; action="${NS}${method}"`,
        },
        body: envelope,
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    const text = await response.text()

    // SOAP faults arrive as 500 with a <soap:Fault> body — surface the reason
    if (!response.ok) {
      const faultReason =
        tagText(text, "Text") || tagText(text, "faultstring") || text.slice(0, 500)
      throw new Error(`Huset SOAP ${method} failed (HTTP ${response.status}): ${faultReason}`)
    }

    return text
  }

  /** TestConnection — validates auth (HashKey) without side effects. */
  async testConnection(): Promise<boolean> {
    const xml = await this.call("TestConnection", this.buildAuthBlock())
    return tagText(xml, "TestConnectionResult").toLowerCase() === "true"
  }

  /**
   * UpdateReceiver — create/update the delivery+invoice address for an order.
   * MUST be called before createOrder: the WMS rejects orders whose ReceiverRef
   * it cannot resolve ("can't find Receiver"). Idempotent — upserts by ReceiverRef.
   * Field order follows the WSDL Receiver sequence.
   */
  async upsertReceiver(p: HusetReceiverParams): Promise<void> {
    const rec = `<int:rec>
      <int:ReceiverRef>${xmlEscape(p.receiverRef)}</int:ReceiverRef>
      <int:DeliveryName>${xmlEscape(p.deliveryName)}</int:DeliveryName>
      <int:DeliveryStreetaddress>${xmlEscape(p.deliveryStreet)}</int:DeliveryStreetaddress>
      <int:DeliveryPostalCode>${xmlEscape(p.deliveryPostalCode)}</int:DeliveryPostalCode>
      <int:DeliveryCity>${xmlEscape(p.deliveryCity)}</int:DeliveryCity>
      <int:DeliveryCountryId>${xmlEscape(p.deliveryCountryId)}</int:DeliveryCountryId>
      <int:InvoiceName>${xmlEscape(p.invoiceName || p.deliveryName)}</int:InvoiceName>
      <int:InvoiceStreetaddress>${xmlEscape(p.invoiceStreet || p.deliveryStreet)}</int:InvoiceStreetaddress>
      <int:InvoicePostalCode>${xmlEscape(p.invoicePostalCode || p.deliveryPostalCode)}</int:InvoicePostalCode>
      <int:InvoiceCity>${xmlEscape(p.invoiceCity || p.deliveryCity)}</int:InvoiceCity>
      <int:InvoiceCountryId>${xmlEscape(p.invoiceCountryId || p.deliveryCountryId)}</int:InvoiceCountryId>
      <int:UseInvoiceAddress>false</int:UseInvoiceAddress>
      <int:LanguageId>${xmlEscape(p.languageId || "")}</int:LanguageId>
      <int:Cellphone>${xmlEscape(p.cellphone || "")}</int:Cellphone>
      <int:Email>${xmlEscape(p.email)}</int:Email>
      ${p.deliveryStreet2 ? `<int:DeliveryStreetaddress2>${xmlEscape(p.deliveryStreet2)}</int:DeliveryStreetaddress2>` : ""}
      <int:IsResidential>${p.isResidential === false ? "false" : "true"}</int:IsResidential>
    </int:rec>`
    await this.call("UpdateReceiver", `${this.buildAuthBlock()}${rec}`)
  }

  /**
   * UpdateOutgoingDeliveryOrder — create/update/cancel a sales order in the WMS.
   * Returns OutgoingDeliveryOrderId (int) assigned by Huset.
   * Field order replicates the provider sample.xml exactly.
   */
  async createOrder(p: HusetCreateOrderParams): Promise<number> {
    const itemsXml = p.items
      .map(
        (it) => `<int:WMSItem>
            <int:ArticleRef>${xmlEscape(it.articleRef)}</int:ArticleRef>
            <int:Qty>${Math.max(1, Math.round(it.qty))}</int:Qty>
          </int:WMSItem>`
      )
      .join("\n")

    const odo = `<int:odo>
      <int:ReceiverRef>${xmlEscape(p.receiverRef)}</int:ReceiverRef>
      <int:OutgoingDeliveryItems>
        ${itemsXml}
      </int:OutgoingDeliveryItems>
      <int:DisplayPrice>false</int:DisplayPrice>
      <int:DoSplitDelivery>false</int:DoSplitDelivery>
      <int:OrderNotes>${xmlEscape(p.orderNotes || "")}</int:OrderNotes>
      <int:FreightMeta></int:FreightMeta>
      <int:LogisticsMethodId>${p.logisticsMethodId}</int:LogisticsMethodId>
      <int:OutgoingDeliveryOrderRef>${xmlEscape(p.orderRef)}</int:OutgoingDeliveryOrderRef>
      <int:OutcheckPointId>0</int:OutcheckPointId>
      <int:PaymentMeta></int:PaymentMeta>
      <int:SalesOrgId>${p.salesOrgId}</int:SalesOrgId>
      <int:ShowPriceInclVat>true</int:ShowPriceInclVat>
      <int:Field1>${xmlEscape(p.orderRef)}</int:Field1>
      <int:Field2>medusa</int:Field2>
      <int:ReservGoods>true</int:ReservGoods>
      <int:OverrideAdress>${xmlEscape(p.overrideAddress || "false")}</int:OverrideAdress>
      <int:DeliveryName>${xmlEscape(p.deliveryName)}</int:DeliveryName>
      <int:DeliveryStreetaddress>${xmlEscape(p.deliveryStreet)}</int:DeliveryStreetaddress>
      <int:DeliveryPostalCode>${xmlEscape(p.deliveryPostalCode)}</int:DeliveryPostalCode>
      <int:DeliveryCity>${xmlEscape(p.deliveryCity)}</int:DeliveryCity>
      <int:DeliveryCountryId>${xmlEscape(p.deliveryCountryId)}</int:DeliveryCountryId>
      <int:InvoiceName>${xmlEscape(p.invoiceName || p.deliveryName)}</int:InvoiceName>
      <int:InvoiceStreetaddress>${xmlEscape(p.invoiceStreet || p.deliveryStreet)}</int:InvoiceStreetaddress>
      <int:InvoicePostalCode>${xmlEscape(p.invoicePostalCode || p.deliveryPostalCode)}</int:InvoicePostalCode>
      <int:InvoiceCity>${xmlEscape(p.invoiceCity || p.deliveryCity)}</int:InvoiceCity>
      <int:InvoiceCountryId>${xmlEscape(p.invoiceCountryId || p.deliveryCountryId)}</int:InvoiceCountryId>
      <int:DeliveryEmail>${xmlEscape(p.deliveryEmail)}</int:DeliveryEmail>
      <int:DeliveryContactName>${xmlEscape(p.deliveryContactName)}</int:DeliveryContactName>
      <int:DeliveryCellphone>${xmlEscape(p.deliveryCellphone || "")}</int:DeliveryCellphone>
      <int:CustomerReferenceOrderNo></int:CustomerReferenceOrderNo>
      <int:CustomerReferenceName></int:CustomerReferenceName>
      <int:OrderStatusId>${p.orderStatusId || "Update"}</int:OrderStatusId>
      <int:IsOffer>false</int:IsOffer>
      <int:DoorCode></int:DoorCode>
      <int:PickupLocationCode>${xmlEscape(p.pickupLocationCode || "")}</int:PickupLocationCode>
    </int:odo>`

    const xml = await this.call("UpdateOutgoingDeliveryOrder", `${this.buildAuthBlock()}${odo}`)
    const result = tagText(xml, "UpdateOutgoingDeliveryOrderResult")
    const id = Number(result)
    if (!result || Number.isNaN(id)) {
      throw new Error(`Huset UpdateOutgoingDeliveryOrder returned unexpected result: "${result}" — ${xml.slice(0, 500)}`)
    }
    return id
  }

  /** Cancel an existing order (same call with OrderStatusId=Cancel). */
  async cancelOrder(p: HusetCreateOrderParams): Promise<number> {
    return this.createOrder({ ...p, orderStatusId: "Cancel" })
  }

  /**
   * GetOutgoingDeliveryNotTrans — fetch dispatched shipments not yet acknowledged.
   * Each entry stays in the queue until ackOutgoingDelivery() confirms it.
   */
  async getOutgoingDeliveryNotTrans(): Promise<HusetOutgoingDelivery[]> {
    const xml = await this.call("GetOutgoingDeliveryNotTrans", this.buildAuthBlock())

    return tagBlocks(xml, "OutgoingDelivery").map((block) => {
      const freightBookings: HusetFreightBooking[] = tagBlocks(block, "FreightBooking").map(
        (fb) => ({
          logisticsMethodId: Number(tagText(fb, "LogisticsMethodId")) || null,
          trackcode1: decodeEntities(tagText(fb, "Trackcode1")),
          trackcode2: decodeEntities(tagText(fb, "Trackcode2")),
          weight: Number(tagText(fb, "Weight")) || null,
          trackingUrl: decodeEntities(tagText(fb, "TrackingUrl")),
          logisticsProviderDescription: decodeEntities(tagText(fb, "LogisticsProviderDescription")),
          logisticsMethodDescription: decodeEntities(tagText(fb, "LogisticsMethodDescription")),
        })
      )

      return {
        outgoingDeliveryId: Number(tagText(block, "OutgoingDeliveryId")) || 0,
        outgoingDeliveryOrderId: Number(tagText(block, "OutgoingDeliveryOrderId")) || 0,
        outgoingDeliveryOrderRef: decodeEntities(tagText(block, "OutgoingDeliveryOrderRef")),
        actualDeliveryTimestamp: tagText(block, "ActualDeliveryTimestamp"),
        isSplitDelivery: tagText(block, "IsSplitDelivery").toLowerCase() === "true",
        freightBookings,
        rawXml: block,
      }
    })
  }

  /**
   * UpdateOutgoingDeliveryIntegration — acknowledge a processed delivery so the
   * NotTrans queue stops returning it. MUST be called after successful processing.
   */
  async ackOutgoingDelivery(outgoingDeliveryId: number): Promise<void> {
    await this.call(
      "UpdateOutgoingDeliveryIntegration",
      `${this.buildAuthBlock()}<int:OutgoingDeliveryId>${outgoingDeliveryId}</int:OutgoingDeliveryId>`
    )
  }
}
