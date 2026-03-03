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
 * Called from the upsell page after the customer has already paid for the
 * upsell item via a separate cart + payment flow.
 *
 * Flow:
 * 1. Begin order edit
 * 2. Add upsell item (with custom unit_price if provided)
 * 3. Request order edit
 * 4. Confirm order edit (applies changes to order)
 * 5. Mark any new payment collection as paid (customer already paid via upsell cart)
 * 6. Update order metadata
 */
export async function POST(
  req: MedusaRequest,
  res: MedusaResponse
): Promise<void> {
  try {
    const { id: orderId } = req.params
    const { variant_id, quantity, unit_price, compare_at_unit_price } =
      req.body as {
        variant_id: string
        quantity?: number
        unit_price?: number
        compare_at_unit_price?: number
      }

    if (!variant_id) {
      res.status(400).json({ success: false, message: "variant_id is required" })
      return
    }

    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

    // Verify order exists
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata"],
      filters: { id: orderId },
    })

    if (!orders.length) {
      res.status(404).json({ success: false, message: "Order not found" })
      return
    }

    // Check if upsell was already accepted (idempotency)
    const existingMeta = (orders[0].metadata as Record<string, unknown>) || {}
    if (existingMeta.upsell_accepted) {
      res.json({ success: true, order_id: orderId, message: "Upsell already accepted" })
      return
    }

    // --- ORDER EDIT FLOW ---

    // 1. Begin order edit
    console.log(`[Upsell] Beginning order edit for ${orderId}`)
    await beginOrderEditOrderWorkflow(req.scope).run({
      input: { order_id: orderId },
    })

    // 2. Add upsell item with custom price
    const item: Record<string, any> = {
      variant_id,
      quantity: quantity || 1,
    }
    if (unit_price !== undefined) {
      item.unit_price = unit_price
    }
    if (compare_at_unit_price !== undefined) {
      item.compare_at_unit_price = compare_at_unit_price
    }

    console.log(`[Upsell] Adding item to order edit:`, item)
    await orderEditAddNewItemWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        items: [item],
      },
    })

    // 3. Request the edit
    console.log(`[Upsell] Requesting order edit for ${orderId}`)
    await requestOrderEditRequestWorkflow(req.scope).run({
      input: { order_id: orderId },
    })

    // 4. Confirm the edit (applies changes + creates payment collection for difference)
    console.log(`[Upsell] Confirming order edit for ${orderId}`)
    await confirmOrderEditRequestWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        confirmed_by: "system-upsell",
      },
    })

    // 5. Mark the new payment collection as paid
    //    (customer already paid via separate upsell cart)
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
      // Non-critical: the order edit succeeded even if payment marking fails
      console.warn(`[Upsell] Could not mark payment collection as paid:`, pcErr.message)
    }

    // 6. Update order metadata
    const orderModuleService = req.scope.resolve(Modules.ORDER)
    await orderModuleService.updateOrders(orderId, {
      metadata: {
        ...existingMeta,
        upsell_accepted: true,
        upsell_variant_id: variant_id,
      },
    })

    console.log(`[Upsell] Order edit completed for ${orderId}`)
    res.json({ success: true, order_id: orderId })
  } catch (error: any) {
    console.error("[Upsell] Accept error:", error)
    res.status(500).json({ success: false, message: error.message })
  }
}
