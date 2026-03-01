import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { QUICKBOOKS_MODULE } from "../../../../../modules/quickbooks"
import type QuickBooksModuleService from "../../../../../modules/quickbooks/service"
import {
  ensureValidToken,
  queryCustomer,
  createCustomer,
  createInvoice,
  createPayment,
  getInvoiceWithLink,
  getInvoice,
  voidInvoice,
  deleteInvoice as deleteQBInvoice,
  getCreditMemo,
  deleteCreditMemo,
} from "../../../../../modules/quickbooks/api-client"

/**
 * POST /admin/custom-orders/:id/quickbooks
 *
 * Manually create a QuickBooks invoice for an order.
 * Mirrors Fakturoid manual create logic.
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

    // ── Find QuickBooks config by project_id ──
    const projectId = order.metadata?.project_id
    if (!projectId) {
      res.status(400).json({ error: "Order has no project_id in metadata" })
      return
    }

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

    // ── Resolve billing address (billing > shipping) ──
    const invoiceAddress = order.billing_address || order.shipping_address

    // ── Find or create QBO customer ──
    let customer = await queryCustomer(creds, token, order.email || "")

    if (!customer && order.email) {
      const displayName =
        order.metadata?.company_name ||
        [invoiceAddress?.first_name, invoiceAddress?.last_name]
          .filter(Boolean)
          .join(" ") ||
        order.email

      const customerData: any = {
        DisplayName: displayName,
        PrimaryEmailAddr: { Address: order.email },
      }

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
      }

      if (order.currency_code) {
        customerData.CurrencyRef = {
          value: order.currency_code.toUpperCase(),
        }
      }

      customer = await createCustomer(creds, token, customerData)
    }

    if (!customer) {
      res
        .status(400)
        .json({ error: "Could not find or create QuickBooks customer" })
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
      res.status(400).json({ error: "Order has no line items" })
      return
    }

    // ── Build B2B private note ──
    const b2bParts: string[] = []
    if (order.metadata?.company_name) {
      b2bParts.push(`Company: ${order.metadata.company_name}`)
    }
    if (order.metadata?.kvk_number) {
      b2bParts.push(`Reg. No: ${order.metadata.kvk_number}`)
    }
    if (order.metadata?.vat_number) {
      b2bParts.push(`VAT: ${order.metadata.vat_number}`)
    }

    // ── Create invoice ──
    const invoiceData: any = {
      CustomerRef: { value: customer.Id },
      Line: lines,
      DocNumber: order.display_id?.toString() || undefined,
      CurrencyRef: order.currency_code
        ? { value: order.currency_code.toUpperCase() }
        : undefined,
      BillEmail: order.email ? { Address: order.email } : undefined,
      PrivateNote: b2bParts.length ? b2bParts.join(" | ") : undefined,
    }

    if (invoiceAddress) {
      invoiceData.BillAddr = {
        Line1: invoiceAddress.address_1 || "",
        City: invoiceAddress.city || "",
        PostalCode: invoiceAddress.postal_code || "",
        Country: (invoiceAddress.country_code || "").toUpperCase(),
      }
    }

    const invoice = await createInvoice(creds, token, invoiceData)

    // ── Create payment to mark as paid ──
    const totalAmt = items.reduce(
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

    // ── Get invoice link ──
    const { link: invoiceLink } = await getInvoiceWithLink(
      creds,
      token,
      invoice.Id
    )

    // ── Update order metadata ──
    const existingMeta = order.metadata || {}
    await orderModuleService.updateOrders(id, {
      metadata: {
        ...existingMeta,
        quickbooks_invoice_id: invoice.Id,
        quickbooks_invoice_number: invoice.DocNumber || invoice.Id,
        quickbooks_invoice_url: invoiceLink || "",
        quickbooks_created_at: new Date().toISOString(),
      },
    })

    console.log(
      `[QuickBooks] Manual invoice ${invoice.Id} created for order ${id}`
    )

    res.json({
      success: true,
      invoice_id: invoice.Id,
      invoice_number: invoice.DocNumber || invoice.Id,
      invoice_url: invoiceLink || "",
      order_id: id,
    })
  } catch (error: any) {
    console.error("[QuickBooks] Create invoice error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to create QuickBooks invoice" })
  }
}

/**
 * DELETE /admin/custom-orders/:id/quickbooks
 *
 * Void/delete a QuickBooks invoice and clear order metadata.
 * Strategy: void first (works on all states), fall back to delete.
 */
export async function DELETE(
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
    const qbInvoiceId = metadata.quickbooks_invoice_id
    const qbCreditMemoId = metadata.quickbooks_credit_memo_id
    const projectId = metadata.project_id

    if (!qbInvoiceId) {
      res
        .status(400)
        .json({ error: "No QuickBooks invoice found on this order" })
      return
    }

    // ── Try to void/delete from QuickBooks API (best-effort) ──
    let deletedFromQB = false

    if (projectId) {
      try {
        const configs = await qbService.listQuickBooksConfigs({
          project_id: projectId,
        })

        if (configs.length) {
          const config = configs[0] as any
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

          if (tokenResult) {
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

            // Step 1: Delete credit memo first (if exists)
            if (qbCreditMemoId) {
              try {
                const cm = await getCreditMemo(creds, token, qbCreditMemoId)
                if (cm && cm.SyncToken) {
                  const cmDeleted = await deleteCreditMemo(creds, token, {
                    Id: cm.Id,
                    SyncToken: cm.SyncToken,
                  })
                  console.log(
                    `[QuickBooks] Credit memo ${qbCreditMemoId} ${cmDeleted ? "deleted" : "could not be deleted"} for order ${id}`
                  )
                }
              } catch (cmError: any) {
                console.warn(
                  `[QuickBooks] Could not delete credit memo ${qbCreditMemoId}: ${cmError.message}`
                )
              }
            }

            // Step 2: Void the invoice (then optionally delete)
            const invoice = await getInvoice(creds, token, qbInvoiceId)
            if (invoice && invoice.SyncToken) {
              // Try void first (works on paid invoices)
              const voided = await voidInvoice(creds, token, {
                Id: invoice.Id,
                SyncToken: invoice.SyncToken,
              })

              if (voided) {
                deletedFromQB = true
                console.log(
                  `[QuickBooks] Invoice ${qbInvoiceId} voided for order ${id}`
                )
              } else {
                // Fallback: try delete (works on draft/unpaid)
                const deleted = await deleteQBInvoice(creds, token, {
                  Id: invoice.Id,
                  SyncToken: invoice.SyncToken,
                })
                deletedFromQB = deleted
                console.log(
                  `[QuickBooks] Invoice ${qbInvoiceId} ${deleted ? "deleted" : "could not be deleted"} for order ${id}`
                )
              }
            }
          }
        }
      } catch (apiError: any) {
        console.warn(
          `[QuickBooks] Could not void/delete invoice ${qbInvoiceId}: ${apiError.message}. Clearing metadata anyway.`
        )
      }
    }

    // ── Always clear invoice + credit memo metadata from order ──
    // Use explicit null values — Medusa merges metadata
    await orderModuleService.updateOrders(id, {
      metadata: {
        ...metadata,
        // Invoice fields → null
        quickbooks_invoice_id: null,
        quickbooks_invoice_number: null,
        quickbooks_invoice_url: null,
        quickbooks_created_at: null,
        // Credit memo fields → null
        quickbooks_credit_memo_id: null,
        quickbooks_credit_memo_url: null,
        quickbooks_credit_memo_created_at: null,
      },
    })

    res.json({
      success: true,
      deleted_from_quickbooks: deletedFromQB,
      message: deletedFromQB
        ? "Invoice voided/deleted from QuickBooks and metadata cleared"
        : "Invoice metadata cleared (QuickBooks API deletion skipped or failed)",
      order_id: id,
    })
  } catch (error: any) {
    console.error("[QuickBooks] Delete invoice error:", error)
    res
      .status(500)
      .json({ error: error.message || "Failed to delete QuickBooks invoice" })
  }
}
