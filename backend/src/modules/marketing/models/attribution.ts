import { model } from "@medusajs/framework/utils"

/**
 * marketing_attribution — one row per (email click → order) match inside a
 * 30-day last-click window. Each order can have at most one attribution row
 * (UNIQUE order_id); re-running the attribution job is idempotent.
 *
 * Currency handling: order_total is stored in its native currency, but a
 * snapshot of the FX rate (fx_rate_to_eur) and the EUR value (order_total_eur)
 * are stored alongside so aggregate revenue reports are comparable across
 * projects (NL, DE, PL, SE, CZ).
 */
const MarketingAttribution = model.define("marketing_attribution", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  contact_id: model.text(),
  message_id: model.text().nullable(),
  campaign_id: model.text().nullable(),
  flow_id: model.text().nullable(),
  flow_run_id: model.text().nullable(),
  order_id: model.text(),
  order_display_id: model.text().nullable(),
  click_at: model.dateTime().nullable(),
  order_placed_at: model.dateTime(),
  attribution_window_hours: model.number().nullable(),
  attribution_model: model.text().default("last_click"),
  order_total: model.number(),
  currency_code: model.text(),
  order_total_eur: model.number().nullable(),
  fx_rate_to_eur: model.number().nullable(),
  metadata: model.json().nullable(),
})

export default MarketingAttribution
