import { MedusaService } from "@medusajs/framework/utils"
import ResendConfig from "./models/resend-config"

class ResendConfigModuleService extends MedusaService({
  ResendConfig,
}) {}

export default ResendConfigModuleService
