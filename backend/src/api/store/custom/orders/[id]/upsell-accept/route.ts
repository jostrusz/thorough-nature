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
 * 1. Verify order exists + idempotency check
 * 2. Extract external payment ID from upsell cart's payment collection
 * 3. Ensure region PricePreference is tax-inclusive (NL/BE VAT)
 * 4. ORDER EDIT: Begin
 * 5. ORDER EDIT: Add item
 * 5.5. Fix is_tax_inclusive on new line item BEFORE request
 *      (critical: this affects payment collection amount calculation)
 * 6. ORDER EDIT: Request (calculates payment diff with correct tax)
 * 7. ORDER EDIT: Confirm
 * 8. Mark new payment collection as paid
 * 9. Update order metadata (upsell_accepted, upsell_payment_id, upsell_log)
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
    const orderModuleService = req.scope.resolve(Modules.ORDER) as any

    // ── 1. Verify order exists ──────────────────────────────────
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "metadata", "region_id", "items.id", "items.variant_id"],
      filters: { id: orderId },
    })

    if (!orders.length) {
      res.status(404).json({ success: false, message: "Order not found" })
      return
    }

    // Idempotency: if upsell already accepted, return success
    const existingMeta = (orders[0].metadata as Record<string, unknown>) || {}
    if (existingMeta.upsell_accepted) {
      console.log(`[Upsell] Idempotency: upsell already accepted for ${orderId}`)
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

    console.log(`[Upsell] Starting upsell-accept for order ${orderId}, variant ${variant_id}, unit_price ${unit_price}, upsell_cart_id: ${upsell_cart_id || "NONE"}`)

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
            "payment_collection.payment_sessions.id",
            "payment_collection.payment_sessions.provider_id",
            "payment_collection.payment_sessions.data",
            "payment_collection.payment_sessions.status",
          ],
          filters: { id: upsell_cart_id },
        })

        console.log(`[Upsell] Cart query returned ${carts.length} cart(s)`)

        if (carts.length && (carts[0] as any).payment_collection) {
          const pc = (carts[0] as any).payment_collection
          const payments = pc.payments || []
          const sessions = pc.payment_sessions || []

          console.log(
            `[Upsell] Cart ${upsell_cart_id}: PC status=${pc.status}, ` +
            `${payments.length} payment(s), ${sessions.length} session(s)`
          )

          // Try to extract from payments first
          for (const payment of payments) {
            console.log(
              `[Upsell] Payment ${payment.id}: provider=${payment.provider_id}, ` +
              `data.id=${payment.data?.id || "N/A"}, captured=${payment.captured_at || "N/A"}`
            )
            if (payment.data && payment.data.id) {
              externalPaymentId = String(payment.data.id)
              break
            }
            // Fallback: use Medusa payment ID
            if (!externalPaymentId && payment.id) {
              externalPaymentId = payment.id
            }
          }

          // If no payment ID from payments, try payment sessions
          if (!externalPaymentId) {
            for (const session of sessions) {
              console.log(
                `[Upsell] Session ${session.id}: provider=${session.provider_id}, ` +
                `status=${session.status}, data.id=${session.data?.id || "N/A"}`
              )
              if (session.data && session.data.id) {
                externalPaymentId = String(session.data.id)
                break
              }
            }
          }

          console.log(`[Upsell] Extracted external payment ID: ${externalPaymentId || "NONE"}`)
        } else {
          console.warn(`[Upsell] Cart ${upsell_cart_id} has no payment_collection`)
        }
      } catch (cartErr: any) {
        console.warn(`[Upsell] Could not read upsell cart payment:`, cartErr.message)
      }
    } else {
      console.warn(`[Upsell] No upsell_cart_id provided — cannot extract payment ID`)
    }

    // ── 3. Ensure region PricePreference is tax-inclusive ───────
    const regionId = (orders[0] as any).region_id
    if (regionId) {
      try {
        const pricingModule = req.scope.resolve(Modules.PRICING) as any
        const existing = await pricingModule.listPricePreferences({
          attribute: "region_id",
          value: regionId,
        })

        if (existing.length === 0) {
          await pricingModule.createPricePreferences({
            attribute: "region_id",
            value: regionId,
            is_tax_inclusive: true,
          })
          console.log(`[Upsell] Created tax-inclusive PricePreference for region ${regionId}`)
        } else if (!(existing[0] as any).is_tax_inclusive) {
          await pricingModule.updatePricePreferences(existing[0].id, {
            is_tax_inclusive: true,
          })
          console.log(`[Upsell] Updated PricePreference to tax-inclusive for region ${regionId}`)
        }
      } catch (ppErr: any) {
        console.warn(`[Upsell] Could not set PricePreference:`, ppErr.message)
      }
    }

    // ── 4. ORDER EDIT: Begin ────────────────────────────────────
    console.log(`[Upsell] Step 4: Beginning order edit for ${orderId}`)
    await beginOrderEditOrderWorkflow(req.scope).run({
      input: { order_id: orderId },
    })

    // ── 5. ORDER EDIT: Add upsell item ──────────────────────────
    const item: any = {
      variant_id,
      quantity: quantity || 1,
      is_tax_inclusive: true, // NL/BE: prices include VAT
      ...(unit_price !== undefined && { unit_price }),
      ...(compare_at_unit_price !== undefined && { compare_at_unit_price }),
    }

    console.log(`[Upsell] Step 5: Adding item to order edit:`, JSON.stringify(item))
    await orderEditAddNewItemWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        items: [item],
      },
    })

    // ── 5.5. Fix is_tax_inclusive on new line item BEFORE request ─
    //    CRITICAL: The payment collection amount is calculated during
    //    requestOrderEditRequestWorkflow based on is_tax_inclusive.
    //    If the item was created with is_tax_inclusive=false (default),
    //    tax will be ADDED ON TOP of the price, inflating the payment.
    //    We must fix this BEFORE the request step.
    try {
      const { data: editOrders } = await query.graph({
        entity: "order",
        fields: ["id", "items.id", "items.variant_id", "items.is_tax_inclusive"],
        filters: { id: orderId },
      })

      if (editOrders.length) {
        const newItems = (editOrders[0].items || []).filter(
          (i: any) => !existingItemIds.has(i.id)
        )

        console.log(`[Upsell] Step 5.5: Found ${newItems.length} new item(s) to fix is_tax_inclusive`)

        for (const newItem of newItems) {
          if (!newItem.is_tax_inclusive) {
            console.log(`[Upsell] Setting is_tax_inclusive=true on item ${newItem.id} (was ${newItem.is_tax_inclusive})`)
            await orderModuleService.updateOrderLineItems(newItem.id, {
              is_tax_inclusive: true,
            })
          } else {
            console.log(`[Upsell] Item ${newItem.id} already has is_tax_inclusive=true`)
          }
        }
      }
    } catch (taxErr: any) {
      console.warn(`[Upsell] Step 5.5: Could not fix is_tax_inclusive pre-request:`, taxErr.message)
    }

    // ── 6. ORDER EDIT: Request ──────────────────────────────────
    console.log(`[Upsell] Step 6: Requesting order edit for ${orderId}`)
    await requestOrderEditRequestWorkflow(req.scope).run({
      input: { order_id: orderId },
    })

    // ── 7. ORDER EDIT: Confirm ──────────────────────────────────
    console.log(`[Upsell] Step 7: Confirming order edit for ${orderId}`)
    await confirmOrderEditRequestWorkflow(req.scope).run({
      input: {
        order_id: orderId,
        confirmed_by: "system-upsell",
      },
    })

    // ── 7.5. Post-confirm: verify is_tax_inclusive (safety net) ──
    try {
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
            console.log(`[Upsell] Post-confirm safety: fixing is_tax_inclusive on item ${newItem.id}`)
            await orderModuleService.updateOrderLineItems(newItem.id, {
              is_tax_inclusive: true,
            })
          }
        }
      }
    } catch (taxErr: any) {
      console.warn(`[Upsell] Post-confirm is_tax_inclusive fix error:`, taxErr.message)
    }

    // ── 8. Mark new payment collection as paid ──────────────────
    try {
      const { data: paymentCollections } = await query.graph({
        entity: "order_payment_collection",
        fields: [
          "payment_collection.id",
          "payment_collection.status",
          "payment_collection.amount",
        ],
        filters: { order_id: orderId },
      })

      for (const opc of paymentCollections) {
        const pc = (opc as any).payment_collection
        if (pc && pc.status === "not_paid") {
          console.log(
            `[Upsell] Step 8: Payment collection ${pc.id}: status=${pc.status}, amount=${pc.amount}`
          )

          // Safety net: if the amount includes erroneously added tax,
          // fix it before marking as paid. The upsell price is tax-inclusive,
          // so the payment collection should equal unit_price * quantity.
          const expectedAmount = (unit_price || 0) * (quantity || 1)
          if (expectedAmount > 0 && pc.amount > expectedAmount) {
            console.log(
              `[Upsell] Payment collection amount ${pc.amount} > expected ${expectedAmount}, ` +
              `fixing to ${expectedAmount} (tax was incorrectly added on top)`
            )
            try {
              const paymentModule = req.scope.resolve(Modules.PAYMENT) as any
              await paymentModule.updatePaymentCollections(pc.id, {
                amount: expectedAmount,
              })
              console.log(`[Upsell] Payment collection amount updated to ${expectedAmount}`)
            } catch (amountErr: any) {
              console.warn(`[Upsell] Could not fix payment collection amount:`, amountErr.message)
            }
          }

          await markPaymentCollectionAsPaid(req.scope).run({
            input: {
              payment_collection_id: pc.id,
              order_id: orderId,
              captured_by: "system-upsell",
            },
          })
          console.log(`[Upsell] Payment collection ${pc.id} marked as paid`)
        }
      }
    } catch (pcErr: any) {
      console.warn(`[Upsell] Could not mark payment collection as paid:`, pcErr.message)
    }

    // ── 9. Update order metadata ───────────────────────────────
    const now = new Date().toISOString()
    const metadata: Record<string, unknown> = {
      ...existingMeta,
      upsell_accepted: true,
      upsell_accepted_at: now,
      upsell_variant_id: variant_id,
    }

    // Store upsell_payment_id (external or fallback to "unknown")
    if (externalPaymentId) {
      metadata.upsell_payment_id = externalPaymentId
    } else {
      // Store a marker so we know the extraction failed
      metadata.upsell_payment_id = "extraction_failed"
      console.warn(`[Upsell] No external payment ID extracted — stored 'extraction_failed'`)
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
        : [
            {
              event: "upsell_payment_id_missing",
              timestamp: now,
              message: `Could not extract payment ID from cart ${upsell_cart_id || "N/A"}`,
            },
          ]),
    ]

    await orderModuleService.updateOrders(orderId, { metadata })

    console.log(
      `[Upsell] ✅ Order edit completed for ${orderId}` +
      (externalPaymentId ? `, payment: ${externalPaymentId}` : ", NO payment ID")
    )

    res.json({
      success: true,
      order_id: orderId,
      upsell_payment_id: externalPaymentId,
    })
  } catch (error: any) {
    console.error("[Upsell] ❌ Accept error:", error)
    res.status(500).json({ success: false, message: error.message })
  }
}
