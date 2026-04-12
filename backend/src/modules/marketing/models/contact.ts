import { model } from "@medusajs/framework/utils"

/**
 * marketing_contact — a person who can receive marketing emails.
 *
 * Scoped to a brand (same email can be a contact across multiple brands
 * independently). Status transitions:
 *   unconfirmed -> subscribed (via DOI confirmation or direct opt-in)
 *   subscribed -> unsubscribed (via unsub link)
 *   * -> suppressed (via bounce/complaint webhook)
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
  source: model.text().nullable(),              // "popup" | "checkout" | "manual" | "import" | "api"
  consent_version: model.text().nullable(),
  consent_ip: model.text().nullable(),
  consent_user_agent: model.text().nullable(),
  consent_at: model.dateTime().nullable(),
  unsubscribed_at: model.dateTime().nullable(),
  external_id: model.text().nullable(),         // Medusa customer_id link
  properties: model.json().nullable(),
  computed: model.json().nullable(),            // { rfm_score, clv, churn_risk, ... }
  tags: model.json().nullable(),                // text[] stored as JSON for simplicity
  metadata: model.json().nullable(),
})

export default MarketingContact
