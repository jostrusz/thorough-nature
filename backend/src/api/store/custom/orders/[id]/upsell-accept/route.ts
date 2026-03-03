import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  orderEditAddNewItemWorkflow,
  requestOrderEditRequestWorkflow,
  confirmOrderEditRequestWorkflow,
  markPaymentCollectionAsPaid,
} from "@medusajs/medusa/core-flows"

/**
 * POST /store/custom/orders/:id/upsell-accept
 *
 * Adds an upsell product to an existing order using Order Edit workflows.
 * The customer has already paid via a separate upsell cart + payment flow.
 * We do NOT complete that cart (to avoid creating a second order).
 *
 * Flow:
 * 1. Verify payment on upsell cart (extract external payment ID)
 * 2. Begin order edit
 * 3. Add upsell item (tax-inclusive)
 * 4. Request + confirm order edit
 * 5. Fix is_tax_inclusive on the new line item
 * 6. Mark new payment collection as paid
 * 7. Update order metadata (upsell_accepted, upsell_payment_id, etc.)
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id: orderId } = req.params
    const {
      variant_id,
      quantity,
      unit_price,
      compare_at_unit_price,
      upsell_cart_id,
    } = req.body as {
      variant_id: string
      quantity?: number
      unit_price?: number
      compare_at_unit_price?: number
      upsell_cart_id?: string
    }

    if (!variant_id) {
      res.status(400).json({ success: false, message: "variant_id is required" })
      return
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // ── 1. Verify order exists ──────────────────────────────────
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata", "items.id", "items.variant_id"],
      filters: { id: orderId },
    })

    if (!orders.length) {
      res.status(404).json({ success: false, message: "Order not found" })
      return
    }

    // Idempotency: if upsell already accepted, return success
    const existingMeta = (orders[0].metadata as Record<string, unknown>) || {}
    if (existingMeta.upsell_accepted) {
      res.json({
        success: true,
        order_id: orderId,
        upsell_payment_id: existingMeta.upsell_payment_id || null,
        message: "Upsell already accepted",
      })
      return
    }

    // Count existing items (to find the new one after order edit)
    const existingItemIds = new Set(
      (orders[0].items || []).map((i: any) => i.id)
    )

    // ── 2. Extract payment ID from upsell cart ──────────────────
    let externalPaymentId: string | null = null

    if (upsell_cart_id) {
      try {
        const { data: carts } = await query.graph({
          entity: "cart",
          fields: [
            "id",
            "payment_collection.id",
            "payment_collection.status",
            "payment_collection.payments.id",
            "payment_collection.payments.provider_id",
            "payment_collection.payments.data",
            "payment_collection.payments.captured_at",
          ],
          filters: { id: upsell_cart_id },
        })

        if (carts.length && (carts[0] as any).payment_collection) {
          const pc = (carts[0] as any).payment_collection
          const payments = pc.payments || []

          for (const payment of payments) {
            // Extract external ID from payment data
            // Mollie: data.id = "tr_xxx"
            // Stripe: data.id = "pi_xxx"
            // PayPal: data.id = "xxx"
            // Airwallex: data.id = "int_xxx"
            if (payment.data && payment.data.id) {
              externalPaymentId = String(payment.data.id)
              break
            }
            // Fallback: use Medusa payment ID
            if (!externalPaymentId && payment.id) {
              externalPaymentId = payment.id
            }
          }

          console.log(
            `[Upsell] Cart ${upsell_cart_id} payment status: ${pc.status}, ` +
            `external payment ID: ${externalPaymentId}`
          )
        }
      } catch (cartErr: any) {
        console.warn(`[Upsell] Could not read upsell cart payment:`, cartErr.message)
      }
    }

    // ── 3. ORDER EDIT: Begin ────────────────────────────────────
    console.log(`[Upsell] Beginning order edit for ${orderId}`)
    await beginOrderEditOrderWorkflow(req.scope).run({
      input: { order_id: orderId },
    })

    // ── 4. ORDER EDIT: Add upsell item ──────────────────────────
    const item = {
      variant_id,
      quantity: quantity || 1,
      ...(unit_price !== undefined && { unit_price }),
      ...(compare_at_unit_price !== undefined && { compare_at_unit_price }),
    }

    console.log(`[Upsell] Adding item to order edit:`, item)
    await orderEditAddNewItemWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        items: [item],
      },
    })

    // ── 5. ORDER EDIT: Request ──────────────────────────────────
    console.log(`[Upsell] Requesting order edit for ${orderId}`)
    await requestOrderEditRequestWorkflow(req.scope).run({
      input: { order_id: orderId },
    })

    // ── 6. ORDER EDIT: Confirm ──────────────────────────────────
    console.log(`[Upsell] Confirming order edit for ${orderId}`)
    await confirmOrderEditRequestWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        confirmed_by: "system-upsell",
      },
    })

    // ── 7. Fix is_tax_inclusive on the new line item ────────────
    const orderModuleService = req.scope.resolve(Modules.ORDER) as any

    try {
      // Re-fetch order to find the newly added line item
      const { data: updatedOrders } = await query.graph({
        entity: "order",
        fields: ["id", "items.id", "items.variant_id", "items.is_tax_inclusive"],
        filters: { id: orderId },
      })

      if (updatedOrders.length) {
        const newItems = (updatedOrders[0].items || []).filter(
          (i: any) => !existingItemIds.has(i.id)
        )

        for (const newItem of newItems) {
          if (!newItem.is_tax_inclusive) {
            console.log(`[Upsell] Setting is_tax_inclusive=true on item ${newItem.id}`)
            await orderModuleService.updateOrderLineItems(newItem.id, {
              is_tax_inclusive: true,
            })
          }
        }
      }
    } catch (taxErr: any) {
      console.warn(`[Upsell] Could not update is_tax_inclusive:`, taxErr.message)
    }

    // ── 8. Mark new payment collection as paid ──────────────────
    try {
      const { data: paymentCollections } = await query.graph({
        entity: "order_payment_collection",
        fields: ["payment_collection.id", "payment_collection.status"],
        filters: { order_id: orderId },
      })

      for (const opc of paymentCollections) {
        const pc = (opc as any).payment_collection
        if (pc && pc.status !== "captured" && pc.status !== "canceled") {
          console.log(`[Upsell] Marking payment collection ${pc.id} as paid`)
          await markPaymentCollectionAsPaid(req.scope).run({
            input: {
              payment_collection_id: pc.id,
              order_id: orderId,
              captured_by: "system-upsell",
            },
          })
        }
      }
    } catch (pcErr: any) {
      console.warn(`[Upsell] Could not mark payment collection as paid:`, pcErr.message)
    }

    // ── 9. Update order metadata ────────────────────────────────
    const now = new Date().toISOString()
    const metadata: Record<string, unknown> = {
      ...existingMeta,
      upsell_accepted: true,
      upsell_accepted_at: now,
      upsell_variant_id: variant_id,
    }

    // Only store upsell_payment_id if we have one
    if (externalPaymentId) {
      metadata.upsell_payment_id = externalPaymentId
    }

    // Add log entries
    const existingLog = Array.isArray(existingMeta.upsell_log)
      ? (existingMeta.upsell_log as any[])
      : []
    metadata.upsell_log = [
      ...existingLog,
      {
        event: "upsell_accepted",
        timestamp: now,
        message: "Customer accepted upsell offer",
      },
      ...(externalPaymentId
        ? [
            {
              event: "upsell_payment_captured",
              timestamp: now,
              message: `Upsell payment captured`,
              payment_id: externalPaymentId,
            },
          ]
        : []),
    ]

    await orderModuleService.updateOrders(orderId, { metadata })

    console.log(
      `[Upsell] Order edit completed for ${orderId}` +
      (externalPaymentId ? `, payment: ${externalPaymentId}` : "")
    )

    res.json({
      success: true,
      order_id: orderId,
      upsell_payment_id: externalPaymentId,
    })
  } catch (error: any) {
    console.error("[Upsell] Accept error:", error)
    res.status(500).json({ success: false, message: error.message })
  }
}
