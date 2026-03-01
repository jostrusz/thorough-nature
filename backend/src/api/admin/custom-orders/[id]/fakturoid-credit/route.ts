import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { FAKTUROID_MODULE } from "../../../../../modules/fakturoid"
import type FakturoidModuleService from "../../../../../modules/fakturoid/service"
import {
  getAccessToken,
  getInvoice,
  createCreditNote,
  mapCountryToLanguage,
  getOSSMode,
} from "../../../../../modules/fakturoid/api-client"

/**
 * POST /admin/custom-orders/:id/fakturoid-credit
 *
 * Create a credit note (opravny danovy doklad / dobropis)
 * linked to the original Fakturoid invoice on this order.
 *
 * The credit note mirrors the original invoice lines with negative amounts.
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

    // ── Fetch order ──
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
      ],
      filters: { id },
    })

    const order = orders?.[0] as any
    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    const metadata = order.metadata || {}

    // ── Need the original invoice's internal Fakturoid ID ──
    const originalInternalId = metadata.fakturoid_internal_id || metadata.fakturoid_invoice_id
    if (!originalInternalId) {
      res.status(400).json({ error: "No Fakturoid invoice found on this order to create credit note for" })
      return
    }

    const projectId = metadata.project_id
    if (!projectId) {
      res.status(400).json({ error: "Order has no project_id in metadata" })
      return
    }

    // ── Find Fakturoid config ──
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

    const token = tokenResult.access_token
    const creds = {
      slug: config.slug,
      client_id: config.client_id,
      client_secret: config.client_secret,
      user_agent_email: config.user_agent_email,
    }

    // ── Get original invoice to read subject_id and lines ──
    const originalInvoice = await getInvoice(creds, token, Number(originalInternalId))
    if (!originalInvoice) {
      res.status(400).json({ error: "Original invoice not found in Fakturoid" })
      return
    }

    // ── Build credit note lines (negative amounts from order items) ──
    const items = order.items || []
    const lines = items.map((item: any) => ({
      name: item.title || item.product_title || "Item",
      quantity: item.quantity || 1,
      unit_price: -(item.unit_price || 0),
      unit_name: "ks",
    }))

    if (!lines.length) {
      res.status(400).json({ error: "Order has no line items for credit note" })
      return
    }

    // ── Determine language & OSS ──
    const invoiceAddress = order.billing_address || order.shipping_address
    const countryCode = invoiceAddress?.country_code || metadata.country_code || ""
    const language = mapCountryToLanguage(countryCode, config.default_language || "en")
    const oss = getOSSMode(countryCode)

    // ── Create credit note ──
    const creditNote = await createCreditNote(creds, token, {
      document_type: "correction",
      correction_id: Number(originalInternalId),
      subject_id: (originalInvoice as any).subject_id,
      custom_id: metadata.fakturoid_invoice_id
        ? `CN-${metadata.fakturoid_invoice_id}`
        : `CN-${order.id}`,
      order_number: order.display_id?.toString() || order.id,
      currency: order.currency_code?.toUpperCase() || "EUR",
      language,
      oss,
      vat_price_mode: "from_total_with_vat",
      payment_method: "card",
      note: `Opravny danovy doklad k fakture ${metadata.fakturoid_invoice_id || originalInternalId}`,
      lines,
    })

    console.log(
      `[Fakturoid] Credit note ${creditNote.number} created for order ${id} (original: ${originalInternalId})`
    )

    // ── Store credit note metadata on order ──
    await orderModuleService.updateOrders(id, {
      metadata: {
        ...metadata,
        fakturoid_credit_note_id: creditNote.number,
        fakturoid_credit_note_internal_id: creditNote.id.toString(),
        fakturoid_credit_note_url: creditNote.public_html_url,
        fakturoid_credit_note_created_at: new Date().toISOString(),
      },
    })

    res.json({
      success: true,
      credit_note_id: creditNote.number,
      credit_note_internal_id: creditNote.id,
      credit_note_url: creditNote.public_html_url,
      original_invoice_id: originalInternalId,
      order_id: id,
    })
  } catch (error: any) {
    console.error("[Fakturoid] Create credit note error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to create credit note" })
  }
}
