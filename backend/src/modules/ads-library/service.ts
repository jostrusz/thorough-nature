// @ts-nocheck
import { MedusaService } from "@medusajs/framework/utils"
import AdCreative from "./models/ad-creative"
import AdVariant from "./models/ad-variant"
import AdLocalizationJob from "./models/ad-localization-job"

/**
 * Ads Library service — CRUD via MedusaService:
 * listAdCreatives/createAdCreatives/updateAdCreatives/deleteAdCreatives,
 * listAdVariants/..., listAdLocalizationJobs/...
 * Business logic lives in the admin API routes + localize runner.
 */
class AdsLibraryService extends MedusaService({
  AdCreative,
  AdVariant,
  AdLocalizationJob,
}) {}

export default AdsLibraryService
