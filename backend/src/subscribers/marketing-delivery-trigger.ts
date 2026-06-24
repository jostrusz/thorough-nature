// @ts-nocheck
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"

/**
 * marketing-delivery-trigger
 * ──────────────────────────
 * Listens to order.delivery_status_changed (emitted by the mySTOCK/Dextrum
 * webhook whenever an order's delivery status advances — e.g. DISPATCHED,
 * DELIVERED). For every live marketing_flow whose trigger is
 *   { type: "delivery", event|status: "<STATUS>" }
 * and whose status matches the event status, we start a new flow_run for the
 * resolved contact — unless one is already running for that contact+flow.
 *
 * This mirrors marketing-flow-trigger.ts (order.placed) but keys off delivery
 * status instead of order placement, so you can build flows like a
 * post-delivery review request or cross-sell that fire on "Delivered".
 *
 * Purely additive, never throws — the webhook's own side effects (shipment
 * email, PayPal/Klarna tracking, SMS) are unaffected by anything here.
 *
 * NOTE: delivery status is sourced from the mySTOCK webhook, which covers the
 * Dextrum markets (NL/BE/DE/PL/CZ/AT). SE (slapp-taget) ships via PostNord and
 * has no inbound delivery webhook yet, so SE orders won't emit this event.
 */
export default async function marketingDeliveryTrigger({
  event: { data, name },
  container,
}: SubscriberArgs<{ id: string; status: string }>) {
  let pool: Pool | null = null
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const service = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const logger = (container.resolve("logger") as any) || console

    const deliveryStatus = String(data?.status || "").trim().toUpperCase()
    if (!data?.id || !deliveryStatus) return

    // Resolve order → brand → contact
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "email", "metadata"],
      filters: { id: data.id },
    })
    const order = orders?.[0]
    if (!order) return
    const email = (order.email || "").trim().toLowerCase()
    if (!email) return

    const projectId = (order.metadata as any)?.project_id
    if (!projectId) return

    const [brand] = await service.listMarketingBrands({ project_id: projectId } as any)
    if (!brand) return

    // Fetch live flows for this brand (raw SQL — Medusa JSON filters are awkward)
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const { rows: flows } = await pool.query(
      `SELECT id, brand_id, name, definition, trigger, status
       FROM marketing_flow
       WHERE brand_id = $1
         AND status = 'live'
         AND deleted_at IS NULL`,
      [brand.id]
    )

    // Match delivery-triggered flows whose configured status equals this event's
    // status. The admin editor stores the status under `event` (it reuses the
    // generic "type:value" select); accept `status` too for forward-compat.
    const matching = flows.filter((f: any) => {
      const t = f.trigger || {}
      if (t.type !== "delivery") return false
      const wanted = String(t.status ?? t.event ?? "").trim().toUpperCase()
      return wanted === deliveryStatus
    })
    if (!matching.length) return

    // Buyer placed the order earlier, so the contact already exists — but the
    // ingestor may lag on rare races; one short retry is plenty.
    let contact: any = null
    for (let attempt = 0; attempt < 2; attempt++) {
      const rows = (await service.listMarketingContacts({
        brand_id: brand.id,
        email,
      } as any)) as any[]
      if (rows?.[0]) { contact = rows[0]; break }
      await new Promise(r => setTimeout(r, 600))
    }
    if (!contact) {
      logger.warn(
        `[Marketing Delivery Trigger] No contact for ${email}@${brand.slug}; skipping ${matching.length} flow(s) for status ${deliveryStatus}`
      )
      return
    }

    // ───────────────────────────────────────────────────────────────────
    // Compliance gate — never (re)enroll a contact who isn't actively
    // subscribed, or whose email is on the brand's suppression list.
    // ───────────────────────────────────────────────────────────────────
    if (contact.status !== "subscribed") {
      logger.info(
        `[Marketing Delivery Trigger] Contact ${contact.id} (${email}@${brand.slug}) status='${contact.status}' (not subscribed); skipping ${matching.length} flow(s)`
      )
      return
    }

    const { rows: suppressed } = await pool.query(
      `SELECT 1 FROM marketing_suppression
       WHERE brand_id = $1 AND lower(email) = lower($2) AND deleted_at IS NULL
       LIMIT 1`,
      [brand.id, email]
    )
    if (suppressed.length) {
      logger.info(
        `[Marketing Delivery Trigger] Contact ${email}@${brand.slug} is on marketing_suppression; skipping ${matching.length} flow(s)`
      )
      return
    }

    for (const flow of matching) {
      try {
        // Already a non-completed run for this contact+flow? skip (dedupes
        // duplicate DELIVERED/DISPATCHED webhooks). re_entry policy governs
        // whether a completed run can start again.
        const { rows: existing } = await pool.query(
          `SELECT id FROM marketing_flow_run
           WHERE flow_id = $1 AND contact_id = $2
             AND state IN ('running','waiting')
             AND deleted_at IS NULL
           LIMIT 1`,
          [flow.id, contact.id]
        )
        if (existing.length) continue

        // Respect re_entry: if the flow only allows entering once and this
        // contact already completed a run, don't re-enroll on a repeat webhook.
        const reEntry = flow.definition?.re_entry?.type || flow.re_entry_policy?.type || "once"
        if (reEntry === "once") {
          const { rows: everRan } = await pool.query(
            `SELECT id FROM marketing_flow_run
             WHERE flow_id = $1 AND contact_id = $2 AND deleted_at IS NULL
             LIMIT 1`,
            [flow.id, contact.id]
          )
          if (everRan.length) continue
        }

        const firstNode = flow.definition?.nodes?.[0]?.id || null
        if (!firstNode) {
          logger.warn(`[Marketing Delivery Trigger] Flow ${flow.id} has empty definition; skipping`)
          continue
        }

        await service.createMarketingFlowRuns({
          flow_id: flow.id,
          brand_id: brand.id,
          contact_id: contact.id,
          current_node_id: firstNode,
          state: "running",
          started_at: new Date(),
          next_run_at: new Date(),
          context: {
            trigger_event: name,
            delivery_status: deliveryStatus,
            order_id: order.id,
          },
        } as any)

        logger.info(
          `[Marketing Delivery Trigger] Started run for flow "${flow.name}" (${flow.id}) on ${deliveryStatus} — contact ${contact.id}`
        )
      } catch (err: any) {
        logger.warn(
          `[Marketing Delivery Trigger] Could not start run for flow ${flow.id}: ${err?.message || err}`
        )
      }
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn("[Marketing Delivery Trigger] skipped:", err?.message || err)
  } finally {
    if (pool) await pool.end().catch(() => {})
  }
}

export const config: SubscriberConfig = {
  event: "order.delivery_status_changed",
}
