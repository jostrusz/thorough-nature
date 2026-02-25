import { MedusaService } from "@medusajs/framework/utils"
import GatewayConfig from "./models/gateway-config"
import PaymentMethodConfig from "./models/payment-method-config"

class GatewayConfigModuleService extends MedusaService({
  GatewayConfig,
  PaymentMethodConfig,
}) {}

export default GatewayConfigModuleService
