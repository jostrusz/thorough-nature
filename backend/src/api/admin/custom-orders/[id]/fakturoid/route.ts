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
        "items.tax_lines.*",
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
    const existingMeta = order.metadata || {}
    let gatewayPaymentId = ""
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
    // Fallback: check order metadata (set by payment-metadata subscriber)
    if (!gatewayPaymentId) {
      gatewayPaymentId =
        existingMeta.stripePaymentIntentId ||
        existingMeta.molliePaymentId ||
        existingMeta.mollieOrderId ||
        existingMeta.paypalOrderId ||
        existingMeta.klarnaOrderId ||
        existingMeta.comgateTransId ||
        existingMeta.airwallexPaymentIntentId ||
        ""
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
      // Extract VAT rate from Medusa tax lines
      // Rate may be whole number (9 = 9%) or decimal (0.09 = 9%)
      const taxLine = item.tax_lines?.[0]
      if (taxLine?.rate != null) {
        const rate = Number(taxLine.rate)
        line.vat_rate = rate >= 1 ? Math.round(rate) : Math.round(rate * 100)
      }
      return line
    })

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
    // Support both new format (fakturoid_internal_id) and old format (fakturoid_invoice_id was numeric)
    const internalId = metadata.fakturoid_internal_id || metadata.fakturoid_invoice_id
    const projectId = metadata.project_id

    if (!internalId) {
      res.status(400).json({ error: "No Fakturoid invoice found on this order" })
      return
    }

    // ── Try to delete from Fakturoid API (best-effort) ──
    // Order matters: credit note must be deleted BEFORE the invoice
    // (Fakturoid refuses to delete an invoice that has linked corrections)
    let deletedFromFakturoid = false
    const creditNoteInternalId = metadata.fakturoid_credit_note_internal_id || metadata.fakturoid_credit_note_id
    const projectConfigFound = !!projectId

    if (projectConfigFound) {
      try {
        const configs = await (fakturoidService as any).listFakturoidConfigs({
          project_id: projectId,
        })

        if (configs.length) {
          const config = configs[0] as any

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

          // Step 1: Delete credit note first (if exists)
          if (creditNoteInternalId) {
            try {
              const cnResult = await deleteInvoice(creds, tokenResult.access_token, Number(creditNoteInternalId))
              console.log(
                `[Fakturoid] Credit note ${creditNoteInternalId} ${cnResult.deleted ? "deleted" : "could not be deleted"} for order ${id}`
              )
            } catch (cnError: any) {
              console.warn(
                `[Fakturoid] Could not delete credit note ${creditNoteInternalId}: ${cnError.message}`
              )
            }
          }

          // Step 2: Delete the invoice
          const result = await deleteInvoice(creds, tokenResult.access_token, Number(internalId))
          deletedFromFakturoid = result.deleted

          console.log(
            `[Fakturoid] Invoice ${internalId} ${result.deleted ? "deleted" : `not deleted (${result.status})`} for order ${id}`
          )
        }
      } catch (apiError: any) {
        // Fakturoid may refuse to delete paid/sent invoices — that's OK
        // We still clear the metadata so user can recreate
        console.warn(
          `[Fakturoid] Could not delete invoice ${internalId} from Fakturoid API: ${apiError.message}. Clearing metadata anyway.`
        )
      }
    }

    // ── Always clear invoice + credit note metadata from order ──
    // Use explicit null values instead of delete — Medusa merges metadata,
    // so deleted keys would be ignored and old values would persist.
    // Setting to null ensures the keys are actually cleared in the DB.
    await orderModuleService.updateOrders(id, {
      metadata: {
        ...metadata,
        // Invoice fields → null
        fakturoid_invoice_id: null,
        fakturoid_internal_id: null,
        fakturoid_invoice_number: null,
        fakturoid_invoice_url: null,
        fakturoid_created_at: null,
        // Credit note fields → null
        fakturoid_credit_note_id: null,
        fakturoid_credit_note_internal_id: null,
        fakturoid_credit_note_url: null,
        fakturoid_credit_note_created_at: null,
      },
    })

    res.json({
      success: true,
      deleted_from_fakturoid: deletedFromFakturoid,
      message: deletedFromFakturoid
        ? "Invoice deleted from Fakturoid and metadata cleared"
        : "Invoice metadata cleared (Fakturoid API deletion skipped or failed)",
      order_id: id,
    })
  } catch (error: any) {
    console.error("[Fakturoid] Delete invoice error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to delete Fakturoid invoice" })
  }
}
