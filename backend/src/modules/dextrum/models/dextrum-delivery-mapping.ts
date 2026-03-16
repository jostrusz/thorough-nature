import { model } from "@medusajs/framework/utils"

const DextrumDeliveryMapping = model.define("dextrum_delivery_mapping", {
  id: model.id().primaryKey(),

  // Keys: sales_channel_id + shipping_option_id + is_cod = unique mapping
  sales_channel_id: model.text(),
  sales_channel_name: model.text().nullable(),       // cached for display
  shipping_option_id: model.text(),
  shipping_option_name: model.text().nullable(),     // cached for display
  is_cod: model.boolean().default(false),            // true = cash on delivery

  // mySTOCK delivery config
  delivery_type: model.text().default("home"),       // "home" or "pickup"
  delivery_method_id: model.text(),                  // e.g. U0123_GLS_API
  external_carrier_code: model.text().nullable(),    // e.g. 106 (inPost), 151 (Magyar Posta)
  payment_method_id: model.text(),                   // e.g. U0123_OSTATNI or U0123_DOBIRKA

  metadata: model.json().nullable(),
})

export default DextrumDeliveryMapping
