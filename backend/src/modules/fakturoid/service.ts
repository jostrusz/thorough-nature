import { MedusaService } from "@medusajs/framework/utils"
import FakturoidConfig from "./models/fakturoid-config"

class FakturoidModuleService extends MedusaService({
  FakturoidConfig,
}) {}

export default FakturoidModuleService
