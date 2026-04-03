// @ts-nocheck
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { AirwallexApiClient } from "../modules/payment-airwallex/api-client"

/**
 * After order is placed, update the Airwallex payment intent with:
 * - custom_order_number (e.g. NL2026-552) in metadata
 * - merchant_order_id updated to custom_order_number
 *
 * Runs with 5s delay so custom-number subscriber (2s delay) has finished.
 */
export default async function orderPlacedAirwallexUpdateHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    // Wait for custom-number subscriber to finish (it has 2s delay)
    await new Promise((resolve) => setTimeout(resolve, 5000))

    const query = container.resolve("query") as any

    const { data: [order] } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "metadata",
        "shipping_address.*",
        "payment_collections.payments.*",
      ],
      filters: { id: data.id },
    })

    if (!order) return

    const meta = order.metadata || {}

    // Only proceed for Airwallex payments
    const intentId = meta.airwallexPaymentIntentId
    if (!intentId) return

    const customOrderNumber = meta.custom_order_number
    if (!customOrderNumber) {
      console.warn(`[Airwallex Update] Order ${data.id}: no custom_order_number yet, skipping`)
      return
    }

    // Get Airwallex credentials from gateway_config DB
    const { Pool } = await import("pg")
    const dbUrl = process.env.DATABASE_URL
    if (!dbUrl) {
      console.error("[Airwallex Update] DATABASE_URL not set")
      return
    }

    const pool = new Pool({ connectionString: dbUrl, max: 1 })
    try {
      const { rows } = await pool.query(
        `SELECT mode, live_keys, test_keys
         FROM gateway_config
         WHERE provider = 'airwallex' AND is_active = true AND deleted_at IS NULL
         ORDER BY priority ASC LIMIT 1`
      )

      if (rows.length === 0) {
        console.warn("[Airwallex Update] No active Airwallex gateway config found")
        return
      }

      const config = rows[0]
      const isLive = config.mode === "live"
      const keys = isLive ? config.live_keys : config.test_keys
      if (!keys?.api_key || !keys?.secret_key) {
        console.warn("[Airwallex Update] Airwallex keys not configured")
        return
      }

      const logger = { info: console.log, error: console.error, warn: console.warn, debug: () => {} } as any
      const client = new AirwallexApiClient(keys.api_key, keys.secret_key, !isLive, logger, keys.account_id)
      await client.login()

      // Build update payload
      const updatePayload: any = {
        metadata: {
          ...(await client.getPaymentIntent(intentId)).metadata,
          order_number: customOrderNumber,
        },
        merchant_order_id: customOrderNumber,
      }

      await client.updatePaymentIntent(intentId, updatePayload)

      console.log(`[Airwallex Update] Payment intent ${intentId} → order_number: ${customOrderNumber}`)
    } finally {
      await pool.end()
    }
  } catch (error: any) {
    // Non-critical — don't throw
    console.error(`[Airwallex Update] Failed: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
