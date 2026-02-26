import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import MolliePaymentProviderService from "./service"

export const MOLLIE_PROVIDER_ID = "mollie"

export default ModuleProvider(Modules.PAYMENT, {
  services: [MolliePaymentProviderService],
})
