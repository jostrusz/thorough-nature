import { model } from "@medusajs/framework/utils"

const MetaAdsConfig = model.define("meta_ads_config", {
  id: model.id().primaryKey(),
  access_token: model.text(),
  token_status: model.enum(["valid", "expired", "error"]).default("valid"),
  last_validated_at: model.dateTime().nullable(),
})

export default MetaAdsConfig
