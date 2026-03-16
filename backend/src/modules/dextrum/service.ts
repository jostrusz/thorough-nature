import { MedusaService } from "@medusajs/framework/utils"
import DextrumConfig from "./models/dextrum-config"
import DextrumOrderMap from "./models/dextrum-order-map"
import DextrumEventLog from "./models/dextrum-event-log"
import DextrumInventory from "./models/dextrum-inventory"
import DextrumDeliveryMapping from "./models/dextrum-delivery-mapping"

class DextrumModuleService extends MedusaService({
  DextrumConfig,
  DextrumOrderMap,
  DextrumEventLog,
  DextrumInventory,
  DextrumDeliveryMapping,
}) {}

export default DextrumModuleService
