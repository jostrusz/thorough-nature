import { MedusaService } from "@medusajs/framework/utils"
import BillingEntity from "./models/billing-entity"

class BillingEntityModuleService extends MedusaService({
  BillingEntity,
}) {}

export default BillingEntityModuleService
