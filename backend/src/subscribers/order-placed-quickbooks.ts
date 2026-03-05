import { Modules } from "@medusajs/framework/utils"
import { IOrderModuleService, ICustomerModuleService } from "@medusajs/framework/types"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { QUICKBOOKS_MODULE } from "../modules/quickbooks"
import type QuickBooksModuleService from "../modules/quickbooks/service"
import {
  ensureValidToken,
  queryCustomer,
  createCustomer,
  createInvoice,
  createPayment,
  getInvoiceWithLink,
} from "../modules/quickbooks/api-client"
import { resolveInvoicingSystem } from "../utils/resolve-invoicing-system"

/**
 * QuickBooks Invoice Subscriber
 *
 * On every order.placed, if the order's payment gateway billing entity
 * uses QuickBooks as invoicing system:
 * 1. Ensure valid access token (auto-refresh if needed)
 * 2. Get/create customer in QuickBooks
 * 3. Create invoice with line items
 * 4. Create payment to mark as paid
 * 5. Get invoice link
 * 6. Store invoice ID + URL on order & customer metadata
 */
export default async function orderPlacedQuickBooksHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const orderService: IOrderModuleService = container.resolve(Modules.ORDER)
    const qbService = container.resolve(
      QUICKBOOKS_MODULE
    ) as unknown as QuickBooksModuleService

    // ── Route by billing entity invoicing system ──
    const invoicingSystem = await resolveInvoicingSystem(container, data.id)
    if (invoicingSystem && invoicingSystem !== "quickbooks") {
      console.log(
        `[QuickBooks] Order ${data.id} uses invoicing_system="${invoicingSystem}", skipping`
      )
      return
    }

    // ── Retrieve order with relations ──
    const order = await orderService.retrieveOrder(data.id, {
      relations: ["items", "summary", "shipping_address", "billing_address"],
    })

    if (!order) {
      console.warn("[QuickBooks] Order not found:", data.id)
      return
    }

    // ── Match by project_id ──
    const projectId = (order.metadata as any)?.project_id
    if (!projectId) {
      console.log("[QuickBooks] No project_id on order, skipping:", data.id)
      return
    }

    const configs = await qbService.listQuickBooksConfigs({
      project_id: projectId,
    })

    if (!configs.length) {
      console.log(
        `[QuickBooks] No config for project "${projectId}", skipping`
      )
      return
    }

    const config = configs[0] as any
    if (!config.enabled || !config.is_connected) {
      console.log(
        `[QuickBooks] Config for "${projectId}" is disabled or not connected, skipping`
      )
      return
    }

    // ── Get shipping address ──
    let shippingAddress: any = null
    try {
      if (order.shipping_address) {
        shippingAddress = await (
          orderService as any
        ).orderAddressService_.retrieve(order.shipping_address.id)
      }
    } catch {
      // Address not available
    }

    // ── Get billing address (for invoicing — falls back to shipping) ──
    let billingAddress: any = null
    try {
      if ((order as any).billing_address) {
        billingAddress = await (
          orderService as any
        ).orderAddressService_.retrieve((order as any).billing_address.id)
      }
    } catch {
      // Billing address not available
    }

    // For invoicing: billing address takes priority
    const invoiceAddress = billingAddress || shippingAddress

    // ── Ensure valid token ──
    const creds = {
      client_id: config.client_id,
      client_secret: config.client_secret,
      environment: config.environment,
      access_token: config.access_token,
      refresh_token: config.refresh_token,
      access_token_expires_at: config.access_token_expires_at,
      refresh_token_expires_at: config.refresh_token_expires_at,
      realm_id: config.realm_id,
    }

    const tokenResult = await ensureValidToken(creds)

    if (!tokenResult) {
      console.error(
        "[QuickBooks] Tokens expired — need re-authorization for:",
        projectId
      )
      // Mark as disconnected
      await qbService.updateQuickBooksConfigs({
        id: config.id,
        is_connected: false,
      })
      return
    }

    // Persist refreshed tokens
    if (
      tokenResult.access_token !== config.access_token ||
      tokenResult.refresh_token !== config.refresh_token
    ) {
      await qbService.updateQuickBooksConfigs({
        id: config.id,
        access_token: tokenResult.access_token,
        refresh_token: tokenResult.refresh_token,
        access_token_expires_at: tokenResult.access_token_expires_at,
        refresh_token_expires_at: tokenResult.refresh_token_expires_at,
      })
    }

    const token = tokenResult.access_token

    // ── Find or create QBO customer ──
    let customer = await queryCustomer(creds, token, order.email || "")

    if (!customer && order.email) {
      const displayName =
        (order.metadata as any)?.company_name ||
        [invoiceAddress?.first_name, invoiceAddress?.last_name]
          .filter(Boolean)
          .join(" ") ||
        order.email

      const customerData: any = {
        DisplayName: displayName,
        PrimaryEmailAddr: { Address: order.email },
      }

      // BillAddr — use billing (invoice) address for QuickBooks customer
      if (invoiceAddress) {
        customerData.BillAddr = {}
        if (invoiceAddress.address_1)
          customerData.BillAddr.Line1 = invoiceAddress.address_1
        if (invoiceAddress.city)
          customerData.BillAddr.City = invoiceAddress.city
        if (invoiceAddress.postal_code)
          customerData.BillAddr.PostalCode = invoiceAddress.postal_code
        if (invoiceAddress.country_code)
          customerData.BillAddr.Country =
            invoiceAddress.country_code.toUpperCase()
        if (invoiceAddress.province)
          customerData.BillAddr.CountrySubDivisionCode =
            invoiceAddress.province
      }

      // ShipAddr — always use shipping address for delivery
      if (shippingAddress) {
        customerData.ShipAddr = {}
        if (shippingAddress.address_1)
          customerData.ShipAddr.Line1 = shippingAddress.address_1
        if (shippingAddress.city)
          customerData.ShipAddr.City = shippingAddress.city
        if (shippingAddress.postal_code)
          customerData.ShipAddr.PostalCode = shippingAddress.postal_code
        if (shippingAddress.country_code)
          customerData.ShipAddr.Country =
            shippingAddress.country_code.toUpperCase()
        if (shippingAddress.province)
          customerData.ShipAddr.CountrySubDivisionCode =
            shippingAddress.province
      }

      // Currency
      if (order.currency_code) {
        customerData.CurrencyRef = {
          value: order.currency_code.toUpperCase(),
        }
      }

      customer = await createCustomer(creds, token, customerData)
    }

    if (!customer) {
      console.error(
        "[QuickBooks] Could not find or create customer for:",
        order.email
      )
      return
    }

    // ── Build invoice lines ──
    const items = order.items || []
    const defaultItemId = config.default_item_id || "1"

    const lines = items.map((item: any) => ({
      Amount: (item.unit_price || 0) * (item.quantity || 1),
      Description: item.title || item.product_title || "Item",
      DetailType: "SalesItemLineDetail" as const,
      SalesItemLineDetail: {
        ItemRef: { value: defaultItemId, name: "Services" },
        Qty: item.quantity || 1,
        UnitPrice: item.unit_price || 0,
      },
    }))

    if (!lines.length) {
      console.warn("[QuickBooks] No line items for order:", data.id)
      return
    }

    // ── Build B2B private note ──
    const b2bParts: string[] = []
    if ((order.metadata as any)?.company_name) {
      b2bParts.push(`Company: ${(order.metadata as any).company_name}`)
    }
    if ((order.metadata as any)?.kvk_number) {
      b2bParts.push(`Reg. No: ${(order.metadata as any).kvk_number}`)
    }
    if ((order.metadata as any)?.vat_number) {
      b2bParts.push(`VAT: ${(order.metadata as any).vat_number}`)
    }

    // ── Create invoice ──
    const invoiceData: any = {
      CustomerRef: { value: customer.Id },
      Line: lines,
      DocNumber: (order as any).metadata?.custom_order_number || (() => {
        const cc = (invoiceAddress?.country_code || (order as any).shipping_address?.country_code || "XX").toUpperCase()
        const yr = new Date().getFullYear()
        const did = (order as any).display_id
        return did ? `${cc}${yr}-${did}` : undefined
      })(),
      CurrencyRef: order.currency_code
        ? { value: order.currency_code.toUpperCase() }
        : undefined,
      BillEmail: order.email ? { Address: order.email } : undefined,
      PrivateNote: b2bParts.length
        ? b2bParts.join(" | ")
        : undefined,
    }

    // Add billing address to invoice
    if (invoiceAddress) {
      invoiceData.BillAddr = {
        Line1: invoiceAddress.address_1 || "",
        City: invoiceAddress.city || "",
        PostalCode: invoiceAddress.postal_code || "",
        Country: (invoiceAddress.country_code || "").toUpperCase(),
      }
    }

    // Add shipping address to invoice
    if (shippingAddress) {
      invoiceData.ShipAddr = {
        Line1: shippingAddress.address_1 || "",
        City: shippingAddress.city || "",
        PostalCode: shippingAddress.postal_code || "",
        Country: (shippingAddress.country_code || "").toUpperCase(),
      }
    }

    const invoice = await createInvoice(creds, token, invoiceData)

    console.log(
      `[QuickBooks] Invoice ${invoice.Id} created for order ${order.id}`
    )

    // ── Create payment to mark as paid ──
    const totalAmt =
      (order.summary as any)?.current_order_total ||
      (order.summary as any)?.total ||
      items.reduce(
        (sum: number, item: any) =>
          sum + (item.unit_price || 0) * (item.quantity || 1),
        0
      )

    await createPayment(creds, token, {
      CustomerRef: { value: customer.Id },
      TotalAmt: totalAmt,
      Line: [
        {
          Amount: totalAmt,
          LinkedTxn: [{ TxnId: invoice.Id, TxnType: "Invoice" }],
        },
      ],
    })

    console.log(`[QuickBooks] Payment recorded for invoice ${invoice.Id}`)

    // ── Get invoice link ──
    const { link: invoiceLink } = await getInvoiceWithLink(
      creds,
      token,
      invoice.Id
    )

    // ── Update order metadata ──
    try {
      // Only pass new fields — Medusa merges metadata (spreading existingMeta causes race conditions with other subscribers)
      await (orderService as any).updateOrders(order.id, {
        metadata: {
          quickbooks_invoice_id: invoice.Id,
          quickbooks_invoice_number: invoice.DocNumber || invoice.Id,
          quickbooks_invoice_url: invoiceLink || "",
        },
      })
    } catch (metaError: any) {
      console.warn(
        "[QuickBooks] Could not update order metadata:",
        metaError.message
      )
    }

    // ── Update customer metadata ──
    try {
      const customerId = (order as any).customer_id
      if (customerId) {
        const customerService: ICustomerModuleService = container.resolve(
          Modules.CUSTOMER
        )
        const medusaCustomer = await customerService.retrieveCustomer(
          customerId
        )
        await customerService.updateCustomers(customerId, {
          metadata: {
            last_quickbooks_invoice_id: invoice.Id,
            last_quickbooks_invoice_url: invoiceLink || "",
            quickbooks_customer_id: customer.Id,
          },
        })
      }
    } catch (custError: any) {
      console.warn(
        "[QuickBooks] Could not update customer metadata:",
        custError.message
      )
    }

    console.log(
      `[QuickBooks] ✓ Complete: order=${order.id} invoice=${invoice.Id} customer=${customer.Id}`
    )
  } catch (error: any) {
    // Never let invoicing errors crash the order flow
    console.error("[QuickBooks] Error:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
