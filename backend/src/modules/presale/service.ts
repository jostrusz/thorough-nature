import { MedusaService } from "@medusajs/framework/utils"
import PresalePage from "./models/presale-page"
import PresaleRevision from "./models/presale-revision"

class PresaleModuleService extends MedusaService({
  PresalePage,
  PresaleRevision,
}) {}

export default PresaleModuleService
