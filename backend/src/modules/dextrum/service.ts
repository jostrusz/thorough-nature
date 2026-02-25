import { MedusaService } from "@medusajs/framework/utils"
import DextrumConfig from "./models/dextrum-config"
import DextrumOrderMap from "./models/dextrum-order-map"
import DextrumEventLog from "./models/dextrum-event-log"
import DextrumInventory from "./models/dextrum-inventory"

class DextrumModuleService extends MedusaService({
  DextrumConfig,
  DextrumOrderMap,
  DextrumEventLog,
  DextrumInventory,
}) {}

export default DextrumModuleService
