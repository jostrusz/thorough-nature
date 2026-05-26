import { MedusaService } from "@medusajs/framework/utils"
import BriteBankLogo from "./models/brite-bank-logo"

class BriteBankLogosModuleService extends MedusaService({
  BriteBankLogo,
}) {}

export default BriteBankLogosModuleService
