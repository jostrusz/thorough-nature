import { model } from "@medusajs/framework/utils"

const BillingEntity = model.define("billing_entity", {
  id: model.id().primaryKey(),
  // Company identity
  name: model.text(),
  legal_name: model.text(),
  country_code: model.text(),
  // Tax & registration
  tax_id: model.text().nullable(),
  vat_id: model.text().nullable(),
  registration_id: model.text().nullable(),
  // Address (JSON object)
  address: model.json().nullable(),
  // Bank account (JSON: iban, bic, bank_name)
  bank_account: model.json().nullable(),
  // Branding
  logo_url: model.text().nullable(),
  email: model.text().nullable(),
  phone: model.text().nullable(),
  website: model.text().nullable(),
  // Flags
  is_default: model.boolean().default(false),
  // Flexible metadata
  metadata: model.json().nullable(),
})

export default BillingEntity
