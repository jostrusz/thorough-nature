import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService, ICustomerModuleService } from "@medusajs/framework/types"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { FAKTUROID_MODULE } from "../modules/fakturoid"
import type FakturoidModuleService from "../modules/fakturoid/service"
import {
  getAccessToken,
  searchSubject,
  createSubject,
  createInvoice,
  markInvoicePaid,
  mapCountryToLanguage,
  getOSSMode,
} from "../modules/fakturoid/api-client"
import { resolveInvoicingSystem } from "./utils/resolve-invoicing-system"

/**
 * Fakturoid Invoice Subscriber
 *
 * On every order.placed, if the order's payment gateway billing entity
 * uses Fakturoid as invoicing system:
 * 1. Get/create subject (customer) in Fakturoid
 * 2. Create invoice with line items
 * 3. Mark invoice as paid
 * 4. Store invoice ID + URL on order & customer metadata
 */
export default async function orderPlacedFakturoidHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const orderService: IOrderModuleService = container.resolve(Modules.ORDER)
    const fakturoidService = container.resolve(
      FAKTUROID_MODULE
    ) as unknown as FakturoidModuleService

    // ── Route by billing entity invoicing system ──
    const invoicingSystem = await resolveInvoicingSystem(container, data.id)
    if (invoicingSystem && invoicingSystem !== "fakturoid") {
      console.log(
        `[Fakturoid] Order ${data.id} uses invoicing_system="${invoicingSystem}", skipping`
      )
      return
    }

    // ── Retrieve order with relations ──
    const order = await orderService.retrieveOrder(data.id, {
      relations: ["items", "summary", "shipping_address", "billing_address"],
    })

    if (!order) {
      console.warn("[Fakturoid] Order not found:", data.id)
      return
    }

    // ── Match by project_id ──
    const projectId = (order.metadata as any)?.project_id
    if (!projectId) {
      console.log("[Fakturoid] No project_id on order, skipping:", data.id)
      return
    }

    const configs = await fakturoidService.listFakturoidConfigs({
      project_id: projectId,
    })

    if (!configs.length || !(configs[0] as any).enabled) {
      console.log(
        `[Fakturoid] No active config for project "${projectId}", skipping`
      )
      return
    }

    const config = configs[0] as any

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

    // ── Get billing address (used for invoicing — falls back to shipping) ──
    let billingAddress: any = null
    try {
      if ((order as any).billing_address) {
        billingAddress = await (
          orderService as any
        ).orderAddressService_.retrieve((order as any).billing_address.id)
      }
    } catch {
      // Billing address not available — will use shipping
    }

    // For invoicing: billing address takes priority, fallback to shipping
    const invoiceAddress = billingAddress || shippingAddress

    // ── Get/refresh access token ──
    const tokenResult = await getAccessToken({
      slug: config.slug,
      client_id: config.client_id,
      client_secret: config.client_secret,
      user_agent_email: config.user_agent_email,
      access_token: config.access_token,
      token_expires_at: config.token_expires_at,
    })

    // Persist refreshed token
    if (tokenResult.access_token !== config.access_token) {
      await fakturoidService.updateFakturoidConfigs({
        id: config.id,
        access_token: tokenResult.access_token,
        token_expires_at: tokenResult.expires_at,
      })
    }

    const token = tokenResult.access_token
    const creds = {
      slug: config.slug,
      client_id: config.client_id,
      client_secret: config.client_secret,
      user_agent_email: config.user_agent_email,
    }

    // ── Find or create Fakturoid subject ──
    let subject = await searchSubject(creds, token, order.email || "")

    if (!subject && order.email) {
      const subjectData: any = {
        name:
          (order.metadata as any)?.company_name ||
          [invoiceAddress?.first_name, invoiceAddress?.last_name]
            .filter(Boolean)
            .join(" ") ||
          order.email,
        email: order.email,
      }

      // Address — use billing (invoice) address for Fakturoid subject
      if (invoiceAddress) {
        if (invoiceAddress.address_1) subjectData.street = invoiceAddress.address_1
        if (invoiceAddress.city) subjectData.city = invoiceAddress.city
        if (invoiceAddress.postal_code) subjectData.zip = invoiceAddress.postal_code
        if (invoiceAddress.country_code)
          subjectData.country = invoiceAddress.country_code.toUpperCase()
      }

      // B2B info from metadata
      if ((order.metadata as any)?.kvk_number) {
        subjectData.registration_no = (order.metadata as any).kvk_number
      }
      if ((order.metadata as any)?.vat_number) {
        subjectData.vat_no = (order.metadata as any).vat_number
      }

      subject = await createSubject(creds, token, subjectData)
    }

    if (!subject) {
      console.error("[Fakturoid] Could not find or create subject for:", order.email)
      return
    }

    // ── Get payment gateway ID for invoice custom_id ──
    let gatewayPaymentId = ""
    try {
      const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: orderPaymentData } = await queryService.graph({
        entity: "order",
        fields: [
          "payment_collections.payments.provider_id",
          "payment_collections.payments.data",
        ],
        filters: { id: data.id },
      })
      const paymentsList =
        orderPaymentData?.[0]?.payment_collections?.flatMap(
          (pc: any) => pc.payments || []
        ) || []
      const firstPayment = paymentsList[0]
      if (firstPayment?.data) {
        gatewayPaymentId =
          firstPayment.data.molliePaymentId ||
          firstPayment.data.mollieOrderId ||
          firstPayment.data.stripePaymentIntentId ||
          firstPayment.data.payment_intent ||
          firstPayment.data.id ||
          firstPayment.data.payment_id ||
          firstPayment.data.transaction_id ||
          ""
      }
    } catch (payErr: any) {
      console.warn("[Fakturoid] Could not extract payment ID:", payErr.message)
    }
    // Fallback: check order metadata (set by payment-metadata subscriber)
    if (!gatewayPaymentId) {
      const meta = (order.metadata as any) || {}
      gatewayPaymentId =
        meta.stripePaymentIntentId ||
        meta.molliePaymentId ||
        meta.mollieOrderId ||
        meta.paypalOrderId ||
        meta.klarnaOrderId ||
        meta.comgateTransId ||
        meta.airwallexPaymentIntentId ||
        ""
    }

    // ── Fetch tax lines per item via query.graph ──
    // (retrieveOrder doesn't support nested items.tax_lines relation)
    let itemTaxMap: Record<string, number> = {}
    try {
      const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: taxData } = await queryService.graph({
        entity: "order",
        fields: ["items.id", "items.tax_lines.*"],
        filters: { id: data.id },
      })
      const taxItems = taxData?.[0]?.items || []
      for (const ti of taxItems) {
        if (ti.tax_lines?.[0]?.rate != null) {
          const rate = Number(ti.tax_lines[0].rate)
          // Medusa may store rate as whole number (9 = 9%) or decimal (0.09 = 9%)
          itemTaxMap[ti.id] = rate >= 1 ? Math.round(rate) : Math.round(rate * 100)
        }
      }
    } catch (taxErr: any) {
      console.warn("[Fakturoid] Could not fetch tax lines:", taxErr.message)
    }

    // ── Build invoice lines (with VAT rate from Medusa tax lines) ──
    const items = order.items || []
    const lines = items.map((item: any) => {
      const line: any = {
        name: item.title || item.product_title || "Item",
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        unit_name: "ks",
      }
      // VAT rate from tax lines map (e.g. 21, 6, 19)
      if (itemTaxMap[item.id] != null) {
        line.vat_rate = itemTaxMap[item.id]
      }
      return line
    })

    if (!lines.length) {
      console.warn("[Fakturoid] No line items for order:", data.id)
      return
    }

    // ── Determine language & OSS (based on billing/invoice country) ──
    const countryCode =
      invoiceAddress?.country_code ||
      shippingAddress?.country_code ||
      (order.metadata as any)?.country_code ||
      ""
    const language = mapCountryToLanguage(
      countryCode,
      config.default_language || "en"
    )
    const oss = getOSSMode(countryCode)

    // ── Create invoice ──
    const invoice = await createInvoice(creds, token, {
      subject_id: subject.id,
      custom_id: gatewayPaymentId || order.id,
      order_number: (order as any).display_id?.toString() || order.id,
      currency: order.currency_code?.toUpperCase() || "EUR",
      language,
      oss,
      vat_price_mode: "from_total_with_vat",
      payment_method: "card",
      lines,
    })

    console.log(
      `[Fakturoid] Invoice ${invoice.number} created for order ${order.id} (custom_id=${gatewayPaymentId || order.id})`
    )

    // ── Mark as paid (include gateway payment ID in payment record) ──
    await markInvoicePaid(creds, token, invoice.id, {
      gatewayPaymentId: gatewayPaymentId || undefined,
    })
    console.log(`[Fakturoid] Invoice ${invoice.number} marked as paid`)

    // ── Update order metadata ──
    // fakturoid_invoice_id = variable symbol (display field)
    // fakturoid_internal_id = numeric Fakturoid ID (for API operations)
    try {
      const existingMeta = (order.metadata as any) || {}
      await (orderService as any).updateOrders(order.id, {
        metadata: {
          ...existingMeta,
          fakturoid_invoice_id: invoice.number,
          fakturoid_internal_id: invoice.id.toString(),
          fakturoid_invoice_number: invoice.number,
          fakturoid_invoice_url: invoice.public_html_url,
        },
      })
    } catch (metaError: any) {
      console.warn(
        "[Fakturoid] Could not update order metadata:",
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
        const customer = await customerService.retrieveCustomer(customerId)
        const existingCustomerMeta = (customer.metadata as any) || {}
        await customerService.updateCustomers(customerId, {
          metadata: {
            ...existingCustomerMeta,
            last_fakturoid_invoice_id: invoice.number,
            last_fakturoid_invoice_url: invoice.public_html_url,
            fakturoid_subject_id: subject.id.toString(),
          },
        })
      }
    } catch (custError: any) {
      console.warn(
        "[Fakturoid] Could not update customer metadata:",
        custError.message
      )
    }

    console.log(
      `[Fakturoid] ✓ Complete: order=${order.id} invoice=${invoice.number} subject=${subject.id}`
    )
  } catch (error: any) {
    // Never let invoicing errors crash the order flow
    console.error("[Fakturoid] Error:", error.message)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
