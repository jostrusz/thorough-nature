import { MedusaService } from "@medusajs/framework/utils"
import SupportboxConfig from "../models/supportbox-config"
import SupportboxTicket from "../models/supportbox-ticket"
import SupportboxMessage from "../models/supportbox-message"

class SupportboxService extends MedusaService({
  SupportboxConfig,
  SupportboxTicket,
  SupportboxMessage,
}) {}

export default SupportboxService
