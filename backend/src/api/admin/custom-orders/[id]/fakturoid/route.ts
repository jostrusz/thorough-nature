import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FAKTUROID_MODULE } from "../../../../../modules/fakturoid"
import type FakturoidModuleService from "../../../../../modules/fakturoid/service"
import {
  getAccessToken,
  searchSubject,
  createSubject,
  createInvoice,
  markInvoicePaid,
  deleteInvoice,
  mapCountryToLanguage,
  getOSSMode,
} from "../../../../../modules/fakturoid/api-client"

/**
 * POST /admin/custom-orders/:id/fakturoid
 *
 * Manually create a Fakturoid invoice for an order.
 * Replicates the subscriber logic but triggered from admin UI.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService = req.scope.resolve(Modules.ORDER) as any
    const fakturoidService = req.scope.resolve(
      FAKTUROID_MODULE
    ) as unknown as FakturoidModuleService

    // ── Fetch order with full data ──
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "metadata",
        "items.*",
        "shipping_address.*",
        "billing_address.*",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.data",
      ],
      filters: { id },
    })

    const order = orders?.[0] as any
    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    // ── Find Fakturoid config by project_id ──
    const projectId = order.metadata?.project_id
    if (!projectId) {
      res.status(400).json({ error: "Order has no project_id in metadata" })
      return
    }

    const configs = await (fakturoidService as any).listFakturoidConfigs({
      project_id: projectId,
    })

    if (!configs.length) {
      res.status(400).json({
        error: `No Fakturoid config found for project "${projectId}"`,
      })
      return
    }

    const config = configs[0] as any

    // ── Get access token ──
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
      await (fakturoidService as any).updateFakturoidConfigs({
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

    // ── Resolve billing address (billing > shipping) ──
    const invoiceAddress = order.billing_address || order.shipping_address

    // ── Find or create Fakturoid subject ──
    let subject = await searchSubject(creds, token, order.email || "")

    if (!subject && order.email) {
      const subjectData: any = {
        name:
          order.metadata?.company_name ||
          [invoiceAddress?.first_name, invoiceAddress?.last_name]
            .filter(Boolean)
            .join(" ") ||
          order.email,
        email: order.email,
      }

      if (invoiceAddress) {
        if (invoiceAddress.address_1) subjectData.street = invoiceAddress.address_1
        if (invoiceAddress.city) subjectData.city = invoiceAddress.city
        if (invoiceAddress.postal_code) subjectData.zip = invoiceAddress.postal_code
        if (invoiceAddress.country_code)
          subjectData.country = invoiceAddress.country_code.toUpperCase()
      }

      if (order.metadata?.kvk_number) {
        subjectData.registration_no = order.metadata.kvk_number
      }
      if (order.metadata?.vat_number) {
        subjectData.vat_no = order.metadata.vat_number
      }

      subject = await createSubject(creds, token, subjectData)
    }

    if (!subject) {
      res.status(400).json({ error: "Could not find or create Fakturoid subject" })
      return
    }

    // ── Extract payment gateway ID for custom_id ──
    const payments =
      order.payment_collections?.flatMap((pc: any) => pc.payments || []) || []
    const firstPayment = payments[0]
    let gatewayPaymentId = ""
    if (firstPayment?.data) {
      gatewayPaymentId =
        firstPayment.data.molliePaymentId ||
        firstPayment.data.mollieOrderId ||
        firstPayment.data.payment_intent ||
        firstPayment.data.id ||
        firstPayment.data.payment_id ||
        firstPayment.data.transaction_id ||
        ""
    }

    // ── Build invoice lines ──
    const items = order.items || []
    const lines = items.map((item: any) => ({
      name: item.title || item.product_title || "Item",
      quantity: item.quantity || 1,
      unit_price: item.unit_price || 0,
      unit_name: "ks",
    }))

    if (!lines.length) {
      res.status(400).json({ error: "Order has no line items" })
      return
    }

    // ── Determine language & OSS ──
    const countryCode =
      invoiceAddress?.country_code ||
      order.metadata?.country_code ||
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
      order_number: order.display_id?.toString() || order.id,
      currency: order.currency_code?.toUpperCase() || "EUR",
      language,
      oss,
      vat_price_mode: "from_total_with_vat",
      payment_method: "card",
      lines,
    })

    // ── Mark as paid (include gateway payment ID in payment record) ──
    await markInvoicePaid(creds, token, invoice.id, {
      gatewayPaymentId: gatewayPaymentId || undefined,
    })

    // ── Update order metadata ──
    const existingMeta = order.metadata || {}
    await orderModuleService.updateOrders(id, {
      metadata: {
        ...existingMeta,
        fakturoid_invoice_id: invoice.number,
        fakturoid_internal_id: invoice.id.toString(),
        fakturoid_invoice_number: invoice.number,
        fakturoid_invoice_url: invoice.public_html_url,
        fakturoid_created_at: new Date().toISOString(),
      },
    })

    console.log(
      `[Fakturoid] Manual invoice ${invoice.number} created for order ${id}`
    )

    res.json({
      success: true,
      invoice_id: invoice.number,
      invoice_internal_id: invoice.id,
      invoice_url: invoice.public_html_url,
      order_id: id,
    })
  } catch (error: any) {
    console.error("[Fakturoid] Create invoice error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to create Fakturoid invoice" })
  }
}

/**
 * DELETE /admin/custom-orders/:id/fakturoid
 *
 * Delete a Fakturoid invoice and clear order metadata.
 */
export async function DELETE(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService = req.scope.resolve(Modules.ORDER) as any
    const fakturoidService = req.scope.resolve(
      FAKTUROID_MODULE
    ) as unknown as FakturoidModuleService

    // ── Fetch order metadata ──
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id },
    })

    const order = orders?.[0] as any
    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    const metadata = order.metadata || {}
    const internalId = metadata.fakturoid_internal_id
    const projectId = metadata.project_id

    if (!internalId) {
      res.status(400).json({ error: "No Fakturoid invoice found on this order" })
      return
    }

    // ── Find Fakturoid config ──
    if (!projectId) {
      res.status(400).json({ error: "Order has no project_id in metadata" })
      return
    }

    const configs = await (fakturoidService as any).listFakturoidConfigs({
      project_id: projectId,
    })

    if (!configs.length) {
      res.status(400).json({
        error: `No Fakturoid config found for project "${projectId}"`,
      })
      return
    }

    const config = configs[0] as any

    // ── Get access token ──
    const tokenResult = await getAccessToken({
      slug: config.slug,
      client_id: config.client_id,
      client_secret: config.client_secret,
      user_agent_email: config.user_agent_email,
      access_token: config.access_token,
      token_expires_at: config.token_expires_at,
    })

    if (tokenResult.access_token !== config.access_token) {
      await (fakturoidService as any).updateFakturoidConfigs({
        id: config.id,
        access_token: tokenResult.access_token,
        token_expires_at: tokenResult.expires_at,
      })
    }

    const creds = {
      slug: config.slug,
      client_id: config.client_id,
      client_secret: config.client_secret,
      user_agent_email: config.user_agent_email,
    }

    // ── Delete invoice from Fakturoid ──
    await deleteInvoice(creds, tokenResult.access_token, Number(internalId))

    console.log(
      `[Fakturoid] Invoice ${internalId} deleted for order ${id}`
    )

    // ── Clear invoice metadata from order ──
    const cleanedMeta = { ...metadata }
    delete cleanedMeta.fakturoid_invoice_id
    delete cleanedMeta.fakturoid_internal_id
    delete cleanedMeta.fakturoid_invoice_number
    delete cleanedMeta.fakturoid_invoice_url
    delete cleanedMeta.fakturoid_created_at

    await orderModuleService.updateOrders(id, {
      metadata: cleanedMeta,
    })

    res.json({
      success: true,
      message: "Invoice deleted from Fakturoid",
      order_id: id,
    })
  } catch (error: any) {
    console.error("[Fakturoid] Delete invoice error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to delete Fakturoid invoice" })
  }
}
