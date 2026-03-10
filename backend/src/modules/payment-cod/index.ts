import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import CodPaymentProviderService from "./service"

export const COD_PROVIDER_ID = "cod"

export default ModuleProvider(Modules.PAYMENT, {
  services: [CodPaymentProviderService],
})
