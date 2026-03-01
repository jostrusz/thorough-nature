import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { QUICKBOOKS_MODULE } from "../../../../../modules/quickbooks"
import type QuickBooksModuleService from "../../../../../modules/quickbooks/service"
import {
  ensureValidToken,
  getInvoice,
  createCreditMemo,
} from "../../../../../modules/quickbooks/api-client"

/**
 * POST /admin/custom-orders/:id/quickbooks-credit
 *
 * Create a QuickBooks credit memo linked to the original invoice.
 * Mirrors Fakturoid credit note logic.
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id } = req.params
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService = req.scope.resolve(Modules.ORDER) as any
    const qbService = req.scope.resolve(
      QUICKBOOKS_MODULE
    ) as unknown as QuickBooksModuleService

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
      ],
      filters: { id },
    })

    const order = orders?.[0] as any
    if (!order) {
      res.status(404).json({ error: "Order not found" })
      return
    }

    const metadata = order.metadata || {}

    // ── Need the original QB invoice ID ──
    const originalInvoiceId = metadata.quickbooks_invoice_id
    if (!originalInvoiceId) {
      res.status(400).json({
        error:
          "No QuickBooks invoice found on this order to create credit memo for",
      })
      return
    }

    const projectId = metadata.project_id
    if (!projectId) {
      res.status(400).json({ error: "Order has no project_id in metadata" })
      return
    }

    // ── Find QuickBooks config ──
    const configs = await qbService.listQuickBooksConfigs({
      project_id: projectId,
    })

    if (!configs.length) {
      res.status(400).json({
        error: `No QuickBooks config found for project "${projectId}"`,
      })
      return
    }

    const config = configs[0] as any

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
      res.status(400).json({
        error: "QuickBooks tokens expired — re-authorize in Settings",
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

    // ── Get original invoice to read CustomerRef ──
    const originalInvoice = await getInvoice(creds, token, originalInvoiceId)
    if (!originalInvoice) {
      res
        .status(400)
        .json({ error: "Original invoice not found in QuickBooks" })
      return
    }

    const customerId =
      originalInvoice.CustomerRef?.value || ""

    if (!customerId) {
      res
        .status(400)
        .json({ error: "Original invoice has no customer reference" })
      return
    }

    // ── Build credit memo lines (negative amounts from order items) ──
    const items = order.items || []
    const defaultItemId = config.default_item_id || "1"

    const lines = items.map((item: any) => ({
      Amount: (item.unit_price || 0) * (item.quantity || 1),
      Description: `Credit: ${item.title || item.product_title || "Item"}`,
      DetailType: "SalesItemLineDetail" as const,
      SalesItemLineDetail: {
        ItemRef: { value: defaultItemId, name: "Services" },
        Qty: item.quantity || 1,
        UnitPrice: item.unit_price || 0,
      },
    }))

    if (!lines.length) {
      res
        .status(400)
        .json({ error: "Order has no line items for credit memo" })
      return
    }

    // ── Create credit memo ──
    const creditMemo = await createCreditMemo(creds, token, {
      CustomerRef: { value: customerId },
      Line: lines,
      DocNumber: `CM-${order.display_id || order.id}`,
      CurrencyRef: order.currency_code
        ? { value: order.currency_code.toUpperCase() }
        : undefined,
      PrivateNote: `Credit memo for invoice ${originalInvoice.DocNumber || originalInvoiceId} (Order #${order.display_id || order.id})`,
    })

    console.log(
      `[QuickBooks] Credit memo ${creditMemo.Id} created for order ${id} (original invoice: ${originalInvoiceId})`
    )

    // ── Store credit memo metadata on order ──
    await orderModuleService.updateOrders(id, {
      metadata: {
        ...metadata,
        quickbooks_credit_memo_id: creditMemo.Id,
        quickbooks_credit_memo_url: "",
        quickbooks_credit_memo_created_at: new Date().toISOString(),
      },
    })

    res.json({
      success: true,
      credit_memo_id: creditMemo.Id,
      credit_memo_number: creditMemo.DocNumber || creditMemo.Id,
      original_invoice_id: originalInvoiceId,
      order_id: id,
    })
  } catch (error: any) {
    console.error("[QuickBooks] Create credit memo error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to create credit memo" })
  }
}
