import { MedusaService } from "@medusajs/framework/utils"
import AdvertorialPage from "./models/advertorial-page"

class AdvertorialModuleService extends MedusaService({
  AdvertorialPage,
}) {}

export default AdvertorialModuleService
