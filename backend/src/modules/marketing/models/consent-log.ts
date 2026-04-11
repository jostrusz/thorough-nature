import { model } from "@medusajs/framework/utils"

/**
 * Immutable audit trail of consent actions (GDPR Art. 7, Art. 30).
 * Never deleted — even on GDPR erasure we keep a hashed email for proof.
 */
const MarketingConsentLog = model.define("marketing_consent_log", {
  id: model.id().primaryKey(),
  brand_id: model.text(),
  contact_id: model.text().nullable(),
  email: model.text().nullable(),
  email_hash: model.text().nullable(),           // SHA-256 of lowercased email for post-erasure audit
  action: model.text(),                          // subscribed | confirmed | unsubscribed | preference_changed | gdpr_erasure
  source: model.text().nullable(),
  consent_text_snapshot: model.text().nullable(),
  ip_address: model.text().nullable(),
  user_agent: model.text().nullable(),
  occurred_at: model.dateTime(),
})

export default MarketingConsentLog
