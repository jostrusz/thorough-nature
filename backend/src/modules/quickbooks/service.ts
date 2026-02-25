import { MedusaService } from "@medusajs/framework/utils"
import QuickBooksConfig from "./models/quickbooks-config"

class QuickBooksModuleService extends MedusaService({
  QuickBooksConfig,
}) {}

export default QuickBooksModuleService
