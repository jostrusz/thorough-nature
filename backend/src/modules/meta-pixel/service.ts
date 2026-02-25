import { MedusaService } from "@medusajs/framework/utils"
import MetaPixelConfig from "./models/meta-pixel-config"

class MetaPixelModuleService extends MedusaService({
  MetaPixelConfig,
}) {}

export default MetaPixelModuleService
