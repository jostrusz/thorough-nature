import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { IOrderModuleService } from "@medusajs/framework/types"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { FAKTUROID_MODULE } from "../modules/fakturoid"
import type FakturoidModuleService from "../modules/fakturoid/service"
import {
  getAccessToken,
  getInvoice,
  updateInvoice,
  addPaymentRecord,
} from "../modules/fakturoid/api-client"
import { resolveInvoicingSystem } from "../utils/resolve-invoicing-system"

/**
 * Fakturoid Invoice Update on Order Edit (Upsell)
 *
 * When an order edit is confirmed (upsell accepted):
 * 1. Check if Fakturoid invoice exists (metadata.fakturoid_internal_id)
 * 2. Rebuild ALL invoice lines from current order items
 * 3. PATCH the existing invoice with updated lines
 * 4. Add payment_id_2 to invoice note (non-COD only)
 * 5. Add a second payment record for the upsell amount (non-COD only)
 */
export default async function orderEditFakturoidHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const orderId = data.order_id
    if (!orderId) return

    const orderService: IOrderModuleService = container.resolve(Modules.ORDER)
    const fakturoidService = container.resolve(
      FAKTUROID_MODULE
    ) as unknown as FakturoidModuleService

    // ── Check invoicing system ──
    const invoicingSystem = await resolveInvoicingSystem(container, orderId)
    if (invoicingSystem && invoicingSystem !== "fakturoid") {
      console.log(
        `[Fakturoid:Edit] Order ${orderId} uses invoicing_system="${invoicingSystem}", skipping`
      )
      return
    }

    // ── Retrieve order with relations ──
    const order = await orderService.retrieveOrder(orderId, {
      relations: ["items", "summary", "shipping_address", "billing_address"],
    })

    if (!order) {
      console.warn("[Fakturoid:Edit] Order not found:", orderId)
      return
    }

    const meta = (order.metadata as any) || {}

    // ── Check if Fakturoid invoice exists ──
    const fakturoidInternalId = meta.fakturoid_internal_id
    if (!fakturoidInternalId) {
      console.log(
        `[Fakturoid:Edit] No fakturoid_internal_id on order ${orderId}, skipping`
      )
      return
    }

    const invoiceId = parseInt(fakturoidInternalId, 10)
    if (isNaN(invoiceId)) {
      console.warn(
        `[Fakturoid:Edit] Invalid fakturoid_internal_id "${fakturoidInternalId}" on order ${orderId}`
      )
      return
    }

    // ── Match by project_id to get Fakturoid config ──
    const projectId = meta.project_id
    if (!projectId) {
      console.log(
        "[Fakturoid:Edit] No project_id on order, skipping:", orderId
      )
      return
    }

    const configs = await fakturoidService.listFakturoidConfigs({
      project_id: projectId,
    })

    if (!configs.length || !(configs[0] as any).enabled) {
      console.log(
        `[Fakturoid:Edit] No active config for project "${projectId}", skipping`
      )
      return
    }

    const config = configs[0] as any

    // ── Get OAuth token ──
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

    // ── Determine if COD ──
    const upsellPaymentId = meta.upsell_payment_id || ""
    const isCod = upsellPaymentId === "cod" || !upsellPaymentId

    console.log(
      `[Fakturoid:Edit] Updating invoice ${invoiceId} for order ${orderId}` +
        ` (upsell_payment_id=${upsellPaymentId}, isCod=${isCod})`
    )

    // ── Fetch tax lines per item via query.graph ──
    let itemTaxMap: Record<string, number> = {}
    try {
      const queryService = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data: taxData } = await queryService.graph({
        entity: "order",
        fields: ["items.id", "items.tax_lines.*"],
        filters: { id: orderId },
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
      console.warn("[Fakturoid:Edit] Could not fetch tax lines:", taxErr.message)
    }

    // ── Get existing invoice to read current note + lines ──
    const existingInvoice = await getInvoice(creds, token, invoiceId)
    if (!existingInvoice) {
      console.warn(
        `[Fakturoid:Edit] Could not retrieve invoice ${invoiceId} — may have been deleted`
      )
      return
    }

    // ── Build ALL invoice lines from current order items ──
    // First: mark all existing lines for deletion (by ID + _destroy)
    // Then: add fresh lines from current order items
    // This prevents duplicates when Fakturoid adds lines instead of replacing them
    const existingLines = (existingInvoice as any).lines || []
    const deletedLines = existingLines.map((line: any) => ({
      id: line.id,
      _destroy: true,
    }))

    const items = order.items || []
    const newLines = items.map((item: any) => {
      const line: any = {
        name: item.title || item.product_title || "Item",
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        unit_name: "ks",
      }
      if (itemTaxMap[item.id] != null) {
        line.vat_rate = itemTaxMap[item.id]
      }
      return line
    })

    // Combine: delete old lines + create new ones
    const lines = [...deletedLines, ...newLines]

    if (!newLines.length) {
      console.warn("[Fakturoid:Edit] No line items for order:", orderId)
      return
    }

    // ── Build update payload ──
    const updatePayload: any = { lines }

    // For non-COD: add payment_id_2 to invoice note
    if (!isCod && upsellPaymentId) {
      const existingNote = (existingInvoice as any).note || ""
      const paymentIdNote = `payment_id_2: ${upsellPaymentId}`

      // Only add if not already present
      if (!existingNote.includes("payment_id_2:")) {
        updatePayload.note = existingNote
          ? `${existingNote}\n${paymentIdNote}`
          : paymentIdNote
      }
    }

    // ── PATCH invoice ──
    const updatedInvoice = await updateInvoice(
      creds,
      token,
      invoiceId,
      updatePayload
    )

    if (!updatedInvoice) {
      // Invoice is locked (403)
      console.warn(
        `[Fakturoid:Edit] Invoice ${invoiceId} is locked — cannot update`
      )
      try {
        await (orderService as any).updateOrders(orderId, {
          metadata: {
            fakturoid_upsell_sync_failed: "invoice_locked",
          },
        })
      } catch {
        // Non-fatal
      }
      return
    }

    console.log(
      `[Fakturoid:Edit] Invoice ${invoiceId} lines updated (${lines.length} items)`
    )

    // ── Add second payment record (non-COD only) ──
    if (!isCod && upsellPaymentId) {
      // Calculate upsell amount: difference between new total and original total
      // The existing invoice had the original total before our PATCH
      const originalTotal = parseFloat(existingInvoice.total) || 0
      const newTotal = parseFloat(updatedInvoice.total) || 0
      const upsellAmount = newTotal - originalTotal

      if (upsellAmount > 0) {
        const paymentAdded = await addPaymentRecord(
          creds,
          token,
          invoiceId,
          upsellAmount,
          { gatewayPaymentId: upsellPaymentId }
        )

        if (paymentAdded) {
          console.log(
            `[Fakturoid:Edit] Payment record added: ${upsellAmount} (payment_id: ${upsellPaymentId})`
          )
        } else {
          console.warn(
            `[Fakturoid:Edit] Could not add payment record (invoice locked)`
          )
        }
      } else {
        console.log(
          `[Fakturoid:Edit] No price difference (original=${originalTotal}, new=${newTotal}) — skipping payment record`
        )
      }
    }

    // ── Update order metadata ──
    try {
      await (orderService as any).updateOrders(orderId, {
        metadata: {
          fakturoid_upsell_synced: true,
          fakturoid_upsell_synced_at: new Date().toISOString(),
        },
      })
    } catch (metaErr: any) {
      console.warn(
        "[Fakturoid:Edit] Could not update order metadata:",
        metaErr.message
      )
    }

    console.log(
      `[Fakturoid:Edit] ✓ Complete: order=${orderId} invoice=${invoiceId}` +
        ` items=${lines.length} isCod=${isCod}`
    )
  } catch (error: any) {
    // Never let invoicing errors crash the order flow
    console.error("[Fakturoid:Edit] Error:", error.message)

    // Try to store error in metadata
    try {
      const orderId = data.order_id
      if (orderId) {
        const orderService: IOrderModuleService = container.resolve(
          Modules.ORDER
        )
        await (orderService as any).updateOrders(orderId, {
          metadata: {
            fakturoid_upsell_sync_failed: error.message,
          },
        })
      }
    } catch {
      // Non-fatal
    }
  }
}

export const config: SubscriberConfig = {
  event: "order-edit.confirmed",
}
