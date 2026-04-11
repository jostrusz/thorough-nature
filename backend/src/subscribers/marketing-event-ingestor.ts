import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"

/**
 * marketing-event-ingestor
 * ------------------------
 * Read-only mirror of the `order.placed` event into the marketing module's
 * event stream. It never sends emails, never calls the Medusa Notification
 * Module, never touches transactional subscribers or templates.
 *
 * This is the foundation that lets Phase 3 flows (winback, post-purchase,
 * etc.) trigger off the same source of truth without modifying the original
 * subscribers. Adding a new subscriber for the same event does NOT interfere
 * with existing ones — Medusa dispatches every event to every subscriber.
 *
 * Failure mode: all errors are caught and logged. This subscriber must never
 * block the transactional order flow.
 */
export default async function marketingEventIngestor({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const marketing = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "metadata",
        "shipping_address.*",
        "items.*",
      ],
      filters: { id: data.id },
    })
    const order = orders?.[0]
    if (!order) return

    // Look up brand by project_id
    const projectId = (order.metadata as any)?.project_id as string | undefined
    if (!projectId) return

    const [brand] = await marketing.listMarketingBrands({ project_id: projectId } as any)
    if (!brand) return // brand not seeded yet → silently ignore

    const rawEmail: string | null = order.email || null
    if (!rawEmail) return
    const email = rawEmail.trim().toLowerCase()

    // Upsert contact (status: unconfirmed — we never auto-subscribe from purchases
    // unless the customer explicitly opted in. Transactional communication is
    // a separate legal basis from marketing consent.)
    const existing = (await marketing.listMarketingContacts({
      brand_id: brand.id,
      email,
    } as any)) as any[]

    let contactId: string | undefined = existing?.[0]?.id
    const optInFlag = (order.metadata as any)?.marketing_opt_in === true

    if (!contactId) {
      const created = await marketing.createMarketingContacts({
        brand_id: brand.id,
        email,
        first_name: order.shipping_address?.first_name || null,
        last_name: order.shipping_address?.last_name || null,
        country_code: order.shipping_address?.country_code || null,
        status: optInFlag ? "subscribed" : "unconfirmed",
        source: "checkout",
        external_id: (order as any).customer_id || null,
        consent_at: optInFlag ? new Date() : null,
      } as any)
      contactId = (created as any).id
    } else if (optInFlag && existing[0].status !== "subscribed") {
      await marketing.updateMarketingContacts({
        id: contactId,
        status: "subscribed",
        consent_at: new Date(),
        source: existing[0].source || "checkout",
      } as any)
    }

    // Append event to stream
    await marketing.createMarketingEvents({
      brand_id: brand.id,
      contact_id: contactId,
      email,
      type: "order_placed",
      payload: {
        order_id: order.id,
        display_id: order.display_id,
        total: order.total,
        currency_code: order.currency_code,
        item_count: (order.items || []).length,
      },
      occurred_at: new Date(),
      source: "subscriber:order.placed",
    } as any)
  } catch (err: any) {
    // Never break the order flow — log and move on.
    // eslint-disable-next-line no-console
    console.warn("[marketing-event-ingestor] skipped:", err?.message || err)
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
