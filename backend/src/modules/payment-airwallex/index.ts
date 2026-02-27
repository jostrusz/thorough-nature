import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import AirwallexPaymentProviderService from "./service"

export const AIRWALLEX_PROVIDER_ID = "airwallex"
// Backward-compat alias used by webhook handler
export const AIRWALLEX_MODULE_NAME = AIRWALLEX_PROVIDER_ID

export default ModuleProvider(Modules.PAYMENT, {
  services: [AirwallexPaymentProviderService],
})
