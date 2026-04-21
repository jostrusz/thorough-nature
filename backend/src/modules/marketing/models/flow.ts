import { model } from "@medusajs/framework/utils"

/**
 * marketing_flow — automation flow (trigger + node sequence).
 *
 * `goals` defines exit-on-goal-match criteria: contacts matching any goal
 * during a run immediately exit with state='completed' and goal_id set.
 * Used for attribution ("what % bought the target product via this flow?").
 *
 * `re_entry_policy` controls whether a contact can start the same flow
 * again after finishing / exiting.
 */
const MarketingFlow = model.define("marketing_flow", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  name: model.text(),
  description: model.text().nullable(),
  trigger: model.json(),                         // { type, config }
  definition: model.json(),                      // nodes + edges
  /**
   * Exit goals. Array of:
   *   {
   *     id: string,              // stable ID for attribution reporting
   *     name: string,            // admin-friendly label
   *     type: "event" | "product_purchase" | "segment_match" | "tag_added",
   *     config: {                // type-specific:
   *       // event: { event_type: string, filter?: Record<string, any> }
   *       // product_purchase: { product_keyword?: string, project_slug?: string }
   *       // segment_match: { segment_id: string }
   *       // tag_added: { tag: string }
   *     },
   *     count_as_completed: boolean,  // true=counts as conversion, false=just exits
   *   }
   */
  goals: model.json().nullable(),
  /**
   * Re-entry policy — how often a contact can start this flow:
   *   { mode: "once" | "every" | "unlimited", cooldown_days?: number }
   * Default "once" if null.
   */
  re_entry_policy: model.json().nullable(),
  status: model.text().default("draft"),         // draft | live | paused | archived
  version: model.number().default(1),
  stats: model.json().nullable(),
  metadata: model.json().nullable(),
})

export default MarketingFlow
