// @ts-nocheck
import { Modules, ContainerRegistrationKeys } from '@medusajs/framework/utils'
import { IOrderModuleService } from '@medusajs/framework/types'
import { SubscriberArgs, SubscriberConfig } from '@medusajs/medusa'
import { mergeOrderMetadata } from "../utils/merge-order-metadata"
import { buildPaymentMetadata } from "../utils/build-payment-metadata"

/**
 * Subscriber: Copy payment provider IDs from payment session data → order metadata
 *
 * When an order is placed, the payment session data contains provider-specific IDs
 * (molliePaymentId, klarnaOrderId, etc.). This subscriber copies them into order
 * metadata so webhooks can find the order later.
 *
 * Supported providers: Mollie, Klarna, PayPal, Comgate, Przelewy24, Airwallex, Stripe, Revolut
 */
export default async function orderPlacedPaymentMetadataHandler({
  event: { data },
  container,
}: SubscriberArgs<any>) {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const orderModuleService: IOrderModuleService = container.resolve(Modules.ORDER)

    // Defensive retry for the rare case where the order↔payment_collection link
    // is not visible yet. NOTE: this is NOT what caused the long-running
    // "missing payment_provider" problem — measurement on 2026-07-30 showed the
    // payments and their data are already there on the first read. That was a
    // lost update on the metadata write; see utils/merge-order-metadata.ts.
    const RETRY_DELAYS_MS = [0, 2_000, 5_000]
    let order: any = null
    let payments: any[] = []

    for (let attempt = 0; attempt < RETRY_DELAYS_MS.length; attempt++) {
      if (RETRY_DELAYS_MS[attempt] > 0) {
        await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]))
      }

      const { data: orders } = await query.graph({
        entity: "order",
        fields: [
          "id",
          "metadata",
          "payment_collections.*",
          "payment_collections.payments.*",
        ],
        filters: { id: data.id },
      })

      order = orders?.[0]
      if (!order) return

      payments = order.payment_collections?.flatMap(
        (pc: any) => pc.payments || []
      ) || []

      // Usable = at least one payment whose data carries provider fields
      if (payments.some((p: any) => Object.keys(p?.data || {}).length > 0)) {
        if (attempt > 0) {
          console.log(
            `[Payment Metadata] Order ${data.id}: payments visible after retry #${attempt}`
          )
        }
        break
      }
    }

    if (!payments.length) {
      console.warn(
        `[Payment Metadata] Order ${data.id}: no payments visible after ${RETRY_DELAYS_MS.length} attempts — giving up`
      )
      return
    }

    // Provider→metadata mapping lives in utils/build-payment-metadata.ts so the
    // historical backfill script uses byte-identical logic.
    const { found, metadata: newMetadata } = await buildPaymentMetadata(payments)

    if (!found) return

    // Pass ONLY new fields — Medusa merges metadata at DB level.
    // Spreading existingMetadata snapshot races with other order.placed subscribers
    // (custom-number, dextrum, etc.) and overwrites their concurrently-written fields.
    await mergeOrderMetadata(data.id, newMetadata, "Payment Metadata")

    const provider = newMetadata.payment_method || "unknown"
    const id =
      newMetadata.molliePaymentId ||
      newMetadata.mollieOrderId ||
      newMetadata.klarnaOrderId ||
      newMetadata.paypalOrderId ||
      newMetadata.comgateTransId ||
      newMetadata.p24SessionId ||
      newMetadata.airwallexPaymentIntentId ||
      newMetadata.barionPaymentId ||
      newMetadata.stripePaymentIntentId ||
      newMetadata.novalnetTid ||
      newMetadata.revolutOrderId ||
      newMetadata.payuOrderId ||
      newMetadata.briteSessionId ||
      "n/a"

    console.log(
      `[Payment Metadata] Order ${data.id}: stored ${provider} ID=${id} in metadata`
    )
  } catch (error: any) {
    // Don't throw — this is non-critical
    console.error(`[Payment Metadata] Failed to copy payment ID to order metadata: ${error.message}`)
  }
}

export const config: SubscriberConfig = {
  event: 'order.placed',
}
