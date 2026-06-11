import { MedusaService } from "@medusajs/framework/utils"
import HusetOrderMap from "./models/huset-order-map"

class HusetModuleService extends MedusaService({
  HusetOrderMap,
}) {}

export default HusetModuleService
