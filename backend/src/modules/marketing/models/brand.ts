import { model } from "@medusajs/framework/utils"

/**
 * marketing_brand — one row per brand (dehondenbijbel, loslatenboek, slapp-taget, ...)
 *
 * One Resend account is shared across all brands; each brand uses its own
 * verified marketing subdomain (e.g. news.loslatenboek.nl) as the From address.
 *
 * `resend_api_key_encrypted` is optional per-brand override — if null we fall
 * back to the global env var. When present, it is encrypted with the master
 * secret via src/modules/marketing/utils/crypto.ts.
 */
const MarketingBrand = model.define("marketing_brand", {
  id: model.id().primaryKey(),
  slug: model.text(),                                // "dehondenbijbel"
  display_name: model.text(),
  project_id: model.text(),                           // matches order.metadata.project_id
  storefront_domain: model.text().nullable(),
  marketing_from_email: model.text(),                 // "news@news.loslatenboek.nl"
  marketing_from_name: model.text(),
  marketing_reply_to: model.text().nullable(),
  resend_api_key_encrypted: model.text().nullable(),  // null = use global env var
  resend_domain_id: model.text().nullable(),
  resend_audience_id: model.text().nullable(),
  primary_color: model.text().nullable(),
  logo_url: model.text().nullable(),
  locale: model.text().default("nl"),
  timezone: model.text().default("Europe/Amsterdam"),
  double_opt_in_enabled: model.boolean().default(false),
  tracking_enabled: model.boolean().default(true),
  brand_voice_profile: model.json().nullable(),
  abandoned_cart_owner: model.text().default("transactional_legacy"), // "transactional_legacy" | "marketing_flow" | "none"
  enabled: model.boolean().default(true),
  metadata: model.json().nullable(),
})

export default MarketingBrand
