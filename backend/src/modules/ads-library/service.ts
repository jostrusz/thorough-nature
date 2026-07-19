// @ts-nocheck
import { MedusaService } from "@medusajs/framework/utils"
import AdCreative from "./models/ad-creative"

/**
 * Ads Library service — plain CRUD via MedusaService
 * (listAdCreatives, createAdCreatives, updateAdCreatives, deleteAdCreatives).
 * Business logic lives in the admin API routes.
 */
class AdsLibraryService extends MedusaService({
  AdCreative,
}) {}

export default AdsLibraryService
