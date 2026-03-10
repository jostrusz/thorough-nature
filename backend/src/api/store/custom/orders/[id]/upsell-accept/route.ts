import { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  beginOrderEditOrderWorkflow,
  orderEditAddNewItemWorkflow,
  requestOrderEditRequestWorkflow,
  confirmOrderEditRequestWorkflow,
  markPaymentCollectionAsPaid,
} from "@medusajs/medusa/core-flows"
import Stripe from "stripe"
import { MollieApiClient } from "../../../../../../modules/payment-mollie/api-client"

const GATEWAY_CONFIG_MODULE = "gatewayConfig"

/** Small helper — non-blocking sleep */
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Build a Mollie API client (same pattern as /api/webhooks/mollie/route.ts).
 * 1. Try gateway config from database (admin-configured)
 * 2. Fallback to MOLLIE_API_KEY env var
 */
async function buildMollieClient(req: MedusaRequest): Promise<MollieApiClient> {
  try {
    const gcService = req.scope.resolve(GATEWAY_CONFIG_MODULE) as any
    const configs = await gcService.listGatewayConfigs(
      { provider: "mollie", is_active: true },
      { take: 1 }
    )
    const config = configs[0]
    if (config) {
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      if (keys?.api_key) {
        return new MollieApiClient(keys.api_key, !isLive)
      }
    }
  } catch {
    // Gateway config not available — try env var fallback
  }

  if (process.env.MOLLIE_API_KEY) {
    return new MollieApiClient(
      process.env.MOLLIE_API_KEY,
      process.env.MOLLIE_TEST_MODE !== "false"
    )
  }

  throw new Error("Mollie API key not configured")
}

/**
 * POST /store/custom/orders/:id/upsell-accept
 *
 * Adds an upsell product to an existing order using Order Edit workflows.
 * The customer has already paid via a separate upsell cart + payment flow.
 * We do NOT complete that cart (to avoid creating a second order).
 *
 * IMPORTANT: Before adding the item, we verify the payment was actually
 * completed with the payment provider. If not paid, we return success: false
 * and the frontend redirects to thank-you without the upsell item.
 *
 * Flow:
 * 1. Verify order exists + idempotency check
 * 2. Extract external payment ID from upsell cart's payment collection
 * 2.5. VERIFY payment was actually completed with the provider
 * 3. Ensure region PricePreference is tax-inclusive (NL/BE VAT)
 * 4. ORDER EDIT: Begin
 * 5. ORDER EDIT: Add item
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
      upsell_payment_id: frontendPaymentId,
      is_cod,
    } = req.body as {
      variant_id: string
      quantity?: number
      unit_price?: number
      compare_at_unit_price?: number
      upsell_cart_id?: string
      upsell_payment_id?: string
      is_cod?: boolean
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

    console.log(`[Upsell] Starting upsell-accept for order ${orderId}, variant ${variant_id}, unit_price ${unit_price}, upsell_cart_id: ${upsell_cart_id || "NONE"}, frontend_payment_id: ${frontendPaymentId || "NONE"}`)

    // ── COD SHORTCUT: Skip payment verification entirely ─────────
    // COD upsell doesn't create a separate cart — the upsell amount
    // is simply added to the existing COD order (collected on delivery).
    if (is_cod) {
      console.log(`[Upsell] COD upsell for order ${orderId} — skipping payment verification`)

      // Jump directly to order edit (steps 3-7)
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
          } else if (!(existing[0] as any).is_tax_inclusive) {
            await pricingModule.updatePricePreferences(existing[0].id, {
              is_tax_inclusive: true,
            })
          }
        } catch (ppErr: any) {
          console.warn(`[Upsell] Could not set PricePreference:`, ppErr.message)
        }
      }

      console.log(`[Upsell] COD: Beginning order edit for ${orderId}`)
      await beginOrderEditOrderWorkflow(req.scope).run({
        input: { order_id: orderId },
      })

      const item: any = {
        variant_id,
        quantity: quantity || 1,
        is_tax_inclusive: true,
        ...(unit_price !== undefined && { unit_price }),
        ...(compare_at_unit_price !== undefined && { compare_at_unit_price }),
      }

      console.log(`[Upsell] COD: Adding item to order edit:`, JSON.stringify(item))
      await orderEditAddNewItemWorkflow(req.scope).run({
        input: { order_id: orderId, items: [item] },
      })

      console.log(`[Upsell] COD: Requesting order edit for ${orderId}`)
      await requestOrderEditRequestWorkflow(req.scope).run({
        input: { order_id: orderId },
      })

      console.log(`[Upsell] COD: Confirming order edit for ${orderId}`)
      await confirmOrderEditRequestWorkflow(req.scope).run({
        input: { order_id: orderId, confirmed_by: "system-upsell-cod" },
      })

      // For COD: mark any new "not_paid" payment collections as paid
      // (The order edit creates one for the price difference)
      try {
        const { data: paymentCollections } = await query.graph({
          entity: "order_payment_collection",
          fields: ["payment_collection.id", "payment_collection.status"],
          filters: { order_id: orderId },
        })
        for (const opc of paymentCollections) {
          const pc = (opc as any).payment_collection
          if (pc && pc.status === "not_paid") {
            console.log(`[Upsell] COD: Marking payment collection ${pc.id} as paid`)
            await markPaymentCollectionAsPaid(req.scope).run({
              input: {
                payment_collection_id: pc.id,
                order_id: orderId,
                captured_by: "system-upsell-cod",
              },
            })
          }
        }
      } catch (pcErr: any) {
        console.warn(`[Upsell] COD: Could not mark payment collection as paid:`, pcErr.message)
      }

      // Update metadata
      const now = new Date().toISOString()
      const existingLog = Array.isArray(existingMeta.upsell_log) ? (existingMeta.upsell_log as any[]) : []
      await orderModuleService.updateOrders(orderId, {
        metadata: {
          ...existingMeta,
          upsell_accepted: true,
          upsell_accepted_at: now,
          upsell_variant_id: variant_id,
          upsell_payment_id: "cod",
          upsell_log: [
            ...existingLog,
            { event: "upsell_accepted", timestamp: now, message: "Customer accepted upsell (COD — no payment needed)" },
          ],
        },
      })

      console.log(`[Upsell] ✅ COD order edit completed for ${orderId}`)
      res.json({ success: true, order_id: orderId, upsell_payment_id: "cod" })
      return
    }

    // ── 2. Extract payment ID + session info ─────────────────────
    //    Priority 1: Frontend sends payment ID from gateway return URL
    //      (Stripe adds ?payment_intent=pi_xxx to return URL)
    //    Priority 2: Extract from upsell cart's payment module data
    //    Priority 3: Fallback to Medusa payment ID
    let externalPaymentId: string | null = frontendPaymentId || null
    let upsellPaymentSession: any = null // Store for verification in Step 2.5

    if (externalPaymentId) {
      console.log(`[Upsell] Using frontend-provided payment ID: ${externalPaymentId}`)
    }

    // Always try to get the payment session from the cart (needed for Step 2.5 verification)
    if (upsell_cart_id) {
      try {
        const { data: carts } = await query.graph({
          entity: "cart",
          fields: ["id", "payment_collection.id", "payment_collection.status"],
          filters: { id: upsell_cart_id },
        })

        console.log(`[Upsell] Cart query returned ${carts.length} cart(s)`)

        if (carts.length && (carts[0] as any).payment_collection) {
          const pcId = (carts[0] as any).payment_collection.id
          const pcStatus = (carts[0] as any).payment_collection.status
          console.log(`[Upsell] Cart ${upsell_cart_id}: PC id=${pcId}, status=${pcStatus}`)

          const paymentModule = req.scope.resolve(Modules.PAYMENT) as any

          // Get payment sessions (always exist after initialization)
          try {
            const sessions = await paymentModule.listPaymentSessions(
              { payment_collection_id: pcId },
              { relations: [] }
            )
            console.log(`[Upsell] Payment module: ${sessions.length} session(s)`)

            for (const session of sessions) {
              const dataStr = JSON.stringify(session.data)
              console.log(
                `[Upsell] Session ${session.id}: provider=${session.provider_id}, ` +
                `status=${session.status}, data=${dataStr?.substring(0, 200)}`
              )

              // Store the first session for verification in Step 2.5
              if (!upsellPaymentSession) {
                upsellPaymentSession = session
              }

              // Extract external payment ID if not already set
              if (!externalPaymentId) {
                if (session.data?.id) {
                  externalPaymentId = String(session.data.id)
                  console.log(`[Upsell] Found payment ID from session.data.id: ${externalPaymentId}`)
                  break
                }
                if (session.data?.payment_intent) {
                  externalPaymentId = String(session.data.payment_intent)
                  console.log(`[Upsell] Found payment ID from session.data.payment_intent: ${externalPaymentId}`)
                  break
                }
              }
            }
          } catch (sessErr: any) {
            console.warn(`[Upsell] listPaymentSessions error:`, sessErr.message)
          }

          // If no ID from sessions, try payments
          if (!externalPaymentId) {
            try {
              const payments = await paymentModule.listPayments(
                { payment_collection_id: pcId },
                { relations: [] }
              )
              console.log(`[Upsell] Payment module: ${payments.length} payment(s)`)

              for (const payment of payments) {
                const dataStr = JSON.stringify(payment.data)
                console.log(
                  `[Upsell] Payment ${payment.id}: provider=${payment.provider_id}, ` +
                  `data=${dataStr?.substring(0, 200)}`
                )

                if (payment.data?.id) {
                  externalPaymentId = String(payment.data.id)
                  console.log(`[Upsell] Found payment ID from payment.data.id: ${externalPaymentId}`)
                  break
                }
                if (!externalPaymentId && payment.id) {
                  externalPaymentId = payment.id
                  console.log(`[Upsell] Using Medusa payment ID as fallback: ${externalPaymentId}`)
                }
              }
            } catch (payErr: any) {
              console.warn(`[Upsell] listPayments error:`, payErr.message)
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

    // ── 2.5. Verify payment was actually completed ──────────────
    //    Prevents adding upsell item when customer abandoned payment
    //    or payment failed at the gateway.
    let paymentVerified = false
    let verificationProvider = "unknown"

    const providerId = upsellPaymentSession?.provider_id || ""
    const molliePaymentId = externalPaymentId || upsellPaymentSession?.data?.id

    if (providerId.startsWith("pp_mollie")) {
      // ── MOLLIE: Check payment status via API (with retry) ──
      verificationProvider = "mollie"
      if (molliePaymentId) {
        try {
          const mollieClient = await buildMollieClient(req)
          for (let attempt = 1; attempt <= 3; attempt++) {
            console.log(`[Upsell] Mollie verification attempt ${attempt}/3 for ${molliePaymentId}`)
            const result = await mollieClient.getPayment(String(molliePaymentId))

            if (result.success && result.data?.status === "paid") {
              paymentVerified = true
              console.log(`[Upsell] ✅ Mollie payment ${molliePaymentId} verified as PAID`)
              break
            }

            const mollieStatus = result.data?.status || "unknown"
            console.log(`[Upsell] Mollie payment ${molliePaymentId} status: ${mollieStatus}`)

            // If explicitly failed/expired/canceled — don't retry
            if (
              mollieStatus === "failed" ||
              mollieStatus === "expired" ||
              mollieStatus === "canceled"
            ) {
              console.log(`[Upsell] Mollie payment terminal status: ${mollieStatus} — not retrying`)
              break
            }

            // Status is "open" or "pending" — wait and retry
            if (attempt < 3) {
              await sleep(2000)
            }
          }
        } catch (mollieErr: any) {
          console.warn(`[Upsell] Mollie verification error:`, mollieErr.message)
          // On verification error, don't proceed (safe default)
        }
      } else {
        console.warn(`[Upsell] No Mollie payment ID to verify`)
      }

    } else if (providerId.includes("stripe")) {
      // ── STRIPE: Check payment intent status ──
      verificationProvider = "stripe"
      const stripePaymentId = externalPaymentId // pi_xxx from URL
      if (stripePaymentId) {
        try {
          const stripeSecretKey = process.env.STRIPE_SECRET_KEY || process.env.STRIPE_API_KEY
          if (!stripeSecretKey) {
            console.warn(`[Upsell] No STRIPE_SECRET_KEY env var — trusting redirect`)
            paymentVerified = true
          } else {
            const stripeClient = new Stripe(stripeSecretKey, { apiVersion: "2025-03-31.basil" as any })
            const intent = await stripeClient.paymentIntents.retrieve(stripePaymentId)
            paymentVerified = intent.status === "succeeded"
            console.log(`[Upsell] Stripe payment ${stripePaymentId} status: ${intent.status}, verified: ${paymentVerified}`)
          }
        } catch (stripeErr: any) {
          console.warn(`[Upsell] Stripe verification error:`, stripeErr.message)
          // On error, don't proceed
        }
      } else {
        console.warn(`[Upsell] No Stripe payment ID to verify`)
      }

    } else if (providerId) {
      // ── OTHER PROVIDERS (PayPal, Airwallex, Klarna, etc.) ──
      // These providers only redirect to return URL on successful payment
      // (cancel/failure goes to a different URL or doesn't redirect)
      // Trust the redirect as payment confirmation
      verificationProvider = providerId
      paymentVerified = true
      console.log(`[Upsell] Provider ${providerId}: trusting redirect as payment confirmation`)

    } else {
      // No provider detected — cannot verify
      console.warn(`[Upsell] No payment provider detected — cannot verify payment`)
    }

    if (!paymentVerified) {
      console.log(`[Upsell] ❌ Payment NOT verified for order ${orderId} (provider: ${verificationProvider}) — skipping order edit`)
      res.json({
        success: false,
        payment_status: "not_paid",
        message: "Payment not completed or still pending",
      })
      return
    }

    console.log(`[Upsell] ✅ Payment verified via ${verificationProvider} — proceeding with order edit`)

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

    // NOTE: Step 5.5 removed — items in an active order edit are in a new
    // version and NOT queryable via order.items. The is_tax_inclusive:true
    // is passed directly in the item object above (Step 5), which works.

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
        message: `Customer accepted upsell offer (verified via ${verificationProvider})`,
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
