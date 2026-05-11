// @ts-nocheck
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SubscriberArgs, SubscriberConfig } from "@medusajs/medusa"
import { Pool } from "pg"
import { MARKETING_MODULE } from "../modules/marketing"
import type MarketingModuleService from "../modules/marketing/service"

/**
 * marketing-flow-trigger
 * ──────────────────────
 * Listens to order.placed (and can be extended to other triggering events).
 * For every active (status='live') marketing_flow whose trigger matches
 * order.placed, we start a new flow_run for the resolved contact (unless
 * one is already running for that contact+flow combo).
 *
 * This subscriber is purely additive and never throws — the existing order
 * flow, admin notifier, CAPI pusher etc. all continue to function regardless
 * of what happens here.
 */
export default async function marketingFlowTrigger({
  event: { data, name },
  container,
}: SubscriberArgs<{ id: string }>) {
  let pool: Pool | null = null
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as any
    const service = container.resolve(MARKETING_MODULE) as unknown as MarketingModuleService
    const logger = (container.resolve("logger") as any) || console

    // Resolve order → brand → contact
    const { data: orders } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "email",
        "metadata",
        "shipping_address.*",
      ],
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

    // Fetch active flows for this brand (raw SQL — Medusa JSON filters are awkward)
    pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
    const { rows: flows } = await pool.query(
      `SELECT id, brand_id, name, definition, trigger, status
       FROM marketing_flow
       WHERE brand_id = $1
         AND status = 'live'
         AND deleted_at IS NULL`,
      [brand.id]
    )

    const matching = flows.filter((f: any) => {
      const t = f.trigger || {}
      if (t.type !== "event") return false
      // Editor saves trigger as { type:"event", event:"order.placed" } (flat),
      // but legacy code expected { type:"event", config:{ event:"..." } }.
      // Accept BOTH shapes for backward compatibility.
      const ev = t.config?.event ?? t.event
      return ev === name || ev === "order.placed"
    })
    if (!matching.length) return

    // Find the contact (marketing-event-ingestor will have created it)
    // Subscriber execution order is not guaranteed — marketing-event-ingestor
    // and this subscriber both fire on order.placed. Empirically the ingestor
    // wins ~25% of the time, leaving 75% of buyers permanently un-enrolled.
    // Retry the lookup with backoff to give the ingestor time to finish.
    let contact: any = null
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = (await service.listMarketingContacts({
        brand_id: brand.id,
        email,
      } as any)) as any[]
      if (rows?.[0]) { contact = rows[0]; break }
      // 500ms, 1s, 2s, 4s — ingestor's listMarketingContacts+create takes ~1s
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt)))
    }
    if (!contact) {
      logger.warn(
        `[Marketing Flow Trigger] No contact for ${email}@${brand.slug} after 5 attempts; skipping ${matching.length} flow(s)`
      )
      return
    }

    for (const flow of matching) {
      try {
        // Already a non-completed run for this contact+flow? skip.
        const { rows: existing } = await pool.query(
          `SELECT id FROM marketing_flow_run
           WHERE flow_id = $1 AND contact_id = $2
             AND state IN ('running','waiting')
             AND deleted_at IS NULL
           LIMIT 1`,
          [flow.id, contact.id]
        )
        if (existing.length) continue

        const firstNode = flow.definition?.nodes?.[0]?.id || null
        if (!firstNode) {
          logger.warn(`[Marketing Flow Trigger] Flow ${flow.id} has empty definition; skipping`)
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
            order_id: order.id,
          },
        } as any)

        logger.info(
          `[Marketing Flow Trigger] Started run for flow "${flow.name}" (${flow.id}) — contact ${contact.id}`
        )
      } catch (err: any) {
        logger.warn(
          `[Marketing Flow Trigger] Could not start run for flow ${flow.id}: ${err?.message || err}`
        )
      }
    }
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.warn("[Marketing Flow Trigger] skipped:", err?.message || err)
  } finally {
    if (pool) await pool.end().catch(() => {})
  }
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
