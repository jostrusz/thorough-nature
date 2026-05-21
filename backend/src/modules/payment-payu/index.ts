import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PayUPaymentProviderService from "./service"

export const PAYU_PROVIDER_ID = "payu"
export const PAYU_MODULE_NAME = PAYU_PROVIDER_ID

export default ModuleProvider(Modules.PAYMENT, {
  services: [PayUPaymentProviderService],
})
