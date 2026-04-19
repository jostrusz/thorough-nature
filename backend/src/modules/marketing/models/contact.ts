import { model } from "@medusajs/framework/utils"

/**
 * marketing_contact — a person who can receive marketing emails.
 *
 * Scoped to a brand (same email can be a contact across multiple brands
 * independently). Status transitions:
 *   unconfirmed -> subscribed (via DOI confirmation or direct opt-in)
 *   subscribed -> unsubscribed (via unsub link)
 *   * -> suppressed (via bounce/complaint webhook)
 *
 * Intelligence layer — Contact Intelligence phase:
 *   - acquisition_* : where/how/why they came in (UTM, form, ad, CAC)
 *   - purchase rollups: denormalized from marketing_attribution + Medusa orders
 *   - engagement: last_email_* + open/click totals and rates
 *   - rfm_* + lifecycle_stage: segmentation axes for strategy decisions
 *   - primary_book + purchased_books + category_affinity: product affinity
 *   - delivery_issues_count + last_bounce_type: deliverability health
 *
 * All intelligence fields are nullable and populated by the nightly
 * contact-intelligence cron (or by event-time subscribers where applicable).
 */
const MarketingContact = model.define("marketing_contact", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  email: model.text(),
  phone: model.text().nullable(),
  first_name: model.text().nullable(),
  last_name: model.text().nullable(),
  locale: model.text().nullable(),
  country_code: model.text().nullable(),
  timezone: model.text().nullable(),
  status: model.text().default("unconfirmed"), // unconfirmed | subscribed | unsubscribed | bounced | complained | suppressed
  source: model.text().nullable(),              // coarse bucket kept for backward-compat: "popup" | "checkout" | "manual" | "import" | "api"
  consent_version: model.text().nullable(),
  consent_ip: model.text().nullable(),
  consent_user_agent: model.text().nullable(),
  consent_at: model.dateTime().nullable(),
  unsubscribed_at: model.dateTime().nullable(),
  external_id: model.text().nullable(),         // Medusa customer_id link
  properties: model.json().nullable(),
  computed: model.json().nullable(),
  tags: model.json().nullable(),
  metadata: model.json().nullable(),

  // ── Acquisition ──────────────────────────────────────────────────────
  acquisition_source: model.text().nullable(),        // "popup" | "checkout" | "lead_magnet" | "paid_ad" | "organic" | "referral" | "import" | "api"
  acquisition_medium: model.text().nullable(),        // UTM medium: "facebook" | "google" | "tiktok" | "email" | "direct"
  acquisition_campaign: model.text().nullable(),      // UTM campaign
  acquisition_content: model.text().nullable(),       // UTM content (ad creative ID)
  acquisition_term: model.text().nullable(),          // UTM term
  acquisition_landing_url: model.text().nullable(),
  acquisition_referrer: model.text().nullable(),
  acquisition_form_id: model.text().nullable(),       // FK to marketing_form
  acquisition_lead_magnet: model.text().nullable(),
  acquisition_device: model.text().nullable(),        // "mobile" | "desktop" | "tablet"
  acquisition_fbc: model.text().nullable(),           // Facebook click ID (for ROAS matching)
  acquisition_fbp: model.text().nullable(),           // Facebook browser ID
  acquisition_at: model.dateTime().nullable(),
  acquisition_cost_eur: model.number().nullable(),

  // ── Purchase rollup (denormalized, rebuilt by cron) ──────────────────
  first_order_at: model.dateTime().nullable(),
  last_order_at: model.dateTime().nullable(),
  total_orders: model.number().default(0),
  total_revenue_eur: model.number().default(0),
  avg_order_value_eur: model.number().nullable(),
  email_attributed_orders: model.number().default(0),
  email_attributed_revenue_eur: model.number().default(0),
  first_purchase_source: model.text().nullable(),     // "email_campaign:<id>" | "email_flow:<id>" | "direct" | "paid_ad"
  days_to_first_purchase: model.number().nullable(),

  // ── Engagement ───────────────────────────────────────────────────────
  last_email_sent_at: model.dateTime().nullable(),
  last_email_opened_at: model.dateTime().nullable(),
  last_email_clicked_at: model.dateTime().nullable(),
  emails_sent_total: model.number().default(0),
  emails_opened_total: model.number().default(0),
  emails_clicked_total: model.number().default(0),
  open_rate_30d: model.number().nullable(),
  click_rate_30d: model.number().nullable(),
  engagement_score: model.number().nullable(),        // 0–100 composite

  // ── RFM ──────────────────────────────────────────────────────────────
  rfm_recency: model.number().nullable(),             // 1–5
  rfm_frequency: model.number().nullable(),
  rfm_monetary: model.number().nullable(),
  rfm_score: model.number().nullable(),               // 111–555 (rec*100 + freq*10 + mon)
  rfm_segment: model.text().nullable(),               // champion | loyal | potential_loyal | at_risk | cant_lose | hibernating | lost

  // ── Lifecycle & product affinity ─────────────────────────────────────
  lifecycle_stage: model.text().nullable(),
  // lead | new_customer | active | loyal | at_risk | dormant | sunset | churned
  lifecycle_entered_at: model.dateTime().nullable(),
  primary_book: model.text().nullable(),              // slug of first-purchased project
  purchased_books: model.json().nullable(),           // string[] of project slugs
  category_affinity: model.json().nullable(),         // { "self-help": 2, "dog": 1 }

  // ── Deliverability ───────────────────────────────────────────────────
  delivery_issues_count: model.number().default(0),
  last_bounce_type: model.text().nullable(),          // "hard" | "soft"
  complaint_at: model.dateTime().nullable(),

  computed_at: model.dateTime().nullable(),
})

export default MarketingContact
