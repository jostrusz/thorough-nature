import { model } from "@medusajs/framework/utils"

/**
 * Cached snapshot of one Brite-supported bank for one locale, pulled daily
 * from the Brite Service Presentation API. Used by the storefront bank
 * picker to render <country flag → bank logos> below the country selector.
 *
 * Row uniqueness conceptually: (locale, bank_id). We don't enforce a unique
 * constraint because the daily refresh fully replaces rows for each locale
 * inside a transaction.
 */
const BriteBankLogo = model.define("brite_bank_logo", {
  id: model.id().primaryKey(),
  // ISO-3166-1 alpha-2 e.g. "NL", "SE", "DE" — parsed from filename or locale
  country: model.text(),
  // Brite locale this row was fetched for, e.g. "nl_NL", "sv_SE"
  locale: model.text(),
  // Bank identifier parsed from filename (e.g. "ING_NL" from "001_ING_NL.svg")
  // or supplied directly by Brite API once a richer endpoint is exposed.
  bank_id: model.text(),
  // Human-readable name shown in the picker, e.g. "ING", "Swedbank"
  name: model.text(),
  // Direct URL to the SVG hosted on Brite's CDN
  // (https://presentation.britepayments.io/assets/bank-logos/...)
  logo_url: model.text(),
  // Lower = displayed earlier. Source = order returned by Brite (market-share weighted).
  sort_order: model.number().default(0),
  // Whether to surface this bank in the storefront picker
  is_active: model.boolean().default(true),
  // Free-form: raw filename, hash, anything extra
  metadata: model.json().nullable(),
})

export default BriteBankLogo
