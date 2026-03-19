// @ts-nocheck
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"

/**
 * Update payment provider description with custom order number (e.g. NL2026-72).
 *
 * Runs 5s after order.placed to ensure custom_order_number is already set.
 * Supports: Stripe (paymentIntents.update), Airwallex (PATCH /payment_intents).
 *
 * Non-critical — failures are logged but don't affect order processing.
 */
export default async function orderPlacedPaymentDescriptionHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    // Wait 5s for custom number subscriber (2s delay + processing)
    await new Promise((resolve) => setTimeout(resolve, 5000))

    const query = container.resolve(ContainerRegistrationKeys.QUERY)

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "metadata",
        "payment_collections.payments.*",
      ],
      filters: { id: data.id },
    })

    const order = orders?.[0]
    if (!order) return

    const meta = (order as any).metadata || {}
    const customNumber = meta.custom_order_number
    if (!customNumber) {
      console.log(`[PaymentDescription] Order ${data.id}: no custom_order_number yet, skipping`)
      return
    }

    const payments = (order as any).payment_collections?.flatMap(
      (pc: any) => pc.payments || []
    ) || []

    for (const payment of payments) {
      const paymentData = payment.data || {}
      const providerId = payment.provider_id || ""

      // ─── STRIPE ───
      if (providerId.includes("stripe")) {
        const intentId = paymentData.id || paymentData.stripePaymentIntentId || meta.stripePaymentIntentId
        if (!intentId) continue

        try {
          const { Pool } = require("pg")
          const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
          const { rows } = await pool.query(
            `SELECT live_keys, test_keys, mode, project_slugs
             FROM gateway_config
             WHERE provider = 'stripe' AND is_active = true AND deleted_at IS NULL
             ORDER BY priority ASC`
          )
          await pool.end()

          if (rows.length === 0) continue

          // Match by project
          const projectSlug = meta.project_id || paymentData.project_slug
          let config = null
          if (projectSlug) {
            config = rows.find((r: any) => {
              const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
              return slugs.includes(projectSlug)
            })
          }
          if (!config) {
            config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
          }

          const keys = config.mode === "live" ? config.live_keys : config.test_keys
          const secretKey = keys?.secret_key
          if (!secretKey) continue

          const Stripe = require("stripe")
          const stripe = new Stripe(secretKey)
          await stripe.paymentIntents.update(intentId, {
            description: customNumber,
          })

          console.log(`[PaymentDescription] Stripe ${intentId} → description: ${customNumber}`)
        } catch (err: any) {
          console.warn(`[PaymentDescription] Stripe update failed: ${err.message}`)
        }
        break
      }

      // ─── AIRWALLEX ───
      if (providerId.includes("airwallex")) {
        const intentId = paymentData.intentId || paymentData.airwallexPaymentIntentId || meta.airwallexPaymentIntentId
        if (!intentId) continue

        try {
          const { Pool } = require("pg")
          const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
          const { rows } = await pool.query(
            `SELECT live_keys, test_keys, mode, project_slugs
             FROM gateway_config
             WHERE provider = 'airwallex' AND is_active = true AND deleted_at IS NULL
             ORDER BY priority ASC`
          )
          await pool.end()

          if (rows.length === 0) continue

          // Match by project
          const projectSlug = meta.project_id || paymentData.project_slug
          let config = null
          if (projectSlug) {
            config = rows.find((r: any) => {
              const slugs = Array.isArray(r.project_slugs) ? r.project_slugs : []
              return slugs.includes(projectSlug)
            })
          }
          if (!config) {
            config = rows.find((r: any) => !r.project_slugs || r.project_slugs.length === 0) || rows[0]
          }

          const keys = config.mode === "live" ? config.live_keys : config.test_keys
          const clientId = keys?.client_id
          const apiKey = keys?.api_key
          if (!clientId || !apiKey) continue

          const isLive = config.mode === "live"
          const baseUrl = isLive ? "https://api.airwallex.com" : "https://api-demo.airwallex.com"

          // Authenticate
          const authResp = await fetch(`${baseUrl}/api/v1/authentication/login`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-client-id": clientId,
              "x-api-key": apiKey,
            },
          })
          const authData = await authResp.json()
          const token = authData.token
          if (!token) continue

          // Update payment intent metadata with order number
          await fetch(`${baseUrl}/api/v1/pa/payment_intents/${intentId}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${token}`,
            },
            body: JSON.stringify({
              metadata: { order_number: customNumber },
              descriptor: customNumber.substring(0, 22), // max 22 chars
            }),
          })

          console.log(`[PaymentDescription] Airwallex ${intentId} → description: ${customNumber}`)
        } catch (err: any) {
          console.warn(`[PaymentDescription] Airwallex update failed: ${err.message}`)
        }
        break
      }
    }
  } catch (error: any) {
    console.error(`[PaymentDescription] Error: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
