import { MedusaService } from "@medusajs/framework/utils"
import DigitalDownload from "./models/digital-download"

class DigitalDownloadModuleService extends MedusaService({
  DigitalDownload,
}) {}

export default DigitalDownloadModuleService
