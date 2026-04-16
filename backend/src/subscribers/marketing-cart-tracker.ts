// @ts-nocheck
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"

/**
 * marketing-cart-tracker
 * ──────────────────────
 * Mirrors cart.updated into the marketing event stream so the flow engine
 * and segment DSL can reason about cart activity (abandoned cart recovery
 * via flows, cart-based segmentation, etc.).
 *
 * NOTE — this does NOT auto-create contacts. We only attach a contact if the
 * cart.email already matches an existing marketing_contact for the brand.
 * Auto-creating marketing contacts from anonymous cart activity would violate
 * consent assumptions.
 *
 * Defensive: all errors are swallowed — cart flow must never break.
 */
export default async function marketingCartTracker({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const service = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService

    const { data: carts } = await query.graph({
      entity: "cart",
      fields: [
        "id",
        "email",
        "metadata",
        "currency_code",
        "items.*",
      ],
      filters: { id: data.id },
    })
    const cart = carts?.[0]
    if (!cart) return

    const projectId = (cart.metadata as any)?.project_id
    if (!projectId) return

    const [brand] = await service.listMarketingBrands({ project_id: projectId } as any)
    if (!brand) return

    const rawEmail: string | null = cart.email || null
    const email = rawEmail ? rawEmail.trim().toLowerCase() : null

    // Only attach to an existing contact; never create one here.
    let contactId: string | null = null
    if (email) {
      const existing = (await service.listMarketingContacts({
        brand_id: brand.id,
        email,
      } as any)) as any[]
      contactId = existing?.[0]?.id || null
    }

    // Build minimal, privacy-safe payload snapshot
    const items = (cart.items || []).map((i: any) => ({
      variant_id: i.variant_id,
      product_id: i.product_id,
      title: i.title,
      quantity: i.quantity,
      unit_price: i.unit_price,
    }))

    await service.createMarketingEvents({
      brand_id: brand.id,
      contact_id: contactId,
      email,
      type: "cart_updated",
      payload: {
        cart_id: cart.id,
        currency_code: cart.currency_code,
        item_count: items.length,
        items,
        abandoned_checkout: (cart.metadata as any)?.abandoned_checkout === true,
        checkout_url: (cart.metadata as any)?.checkout_url || null,
      },
      occurred_at: new Date(),
      source: "subscriber:cart.updated",
    } as any)
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn("[Marketing Tracking] cart-tracker skipped:", err?.message || err)
  }
}

export const config: SubscriberConfig = {
  event: "cart.updated",
}
