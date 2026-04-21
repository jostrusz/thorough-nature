import { model } from "@medusajs/framework/utils"

/**
 * marketing_click — one row per email link click.
 *
 * Unlike marketing_attribution (which matches clicks → orders), this table
 * captures EVERY click, even those that never led to a purchase. Enables
 * per-email link breakdown:
 *   "Email #3 had 421 clicks: cta_main 302, secondary 89, footer 30"
 *
 * Written by the click redirect endpoint (/public/marketing/c/:token). The
 * HMAC-signed token already carries message_id + brand_id; campaign_id,
 * flow_id, flow_run_id, contact_id come from the marketing_message row.
 *
 * Unique (message_id, contact_id, link_label, clicked_at) is NOT enforced —
 * we log every click for realistic CTR / link heatmap analytics. For
 * unique-click calculations use DISTINCT in queries.
 */
const MarketingClick = model.define("marketing_click", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  message_id: model.text(),
  contact_id: model.text().nullable(),      // null if message has no contact (unlikely but defensive)
  campaign_id: model.text().nullable(),
  flow_id: model.text().nullable(),
  flow_run_id: model.text().nullable(),
  flow_node_id: model.text().nullable(),    // which email node in a flow
  link_label: model.text().nullable(),      // data-link-label attribute value (e.g. "cta_main")
  target_url: model.text(),                 // full URL (with UTM)
  clicked_at: model.dateTime(),
  user_agent: model.text().nullable(),
  ip_hash: model.text().nullable(),         // SHA256(ip + secret) for dedup without PII
  metadata: model.json().nullable(),
})

export default MarketingClick
