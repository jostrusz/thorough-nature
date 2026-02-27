import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import AirwallexPaymentProviderService from "./service"

export const AIRWALLEX_PROVIDER_ID = "airwallex"

export default ModuleProvider(Modules.PAYMENT, {
  services: [AirwallexPaymentProviderService],
})
