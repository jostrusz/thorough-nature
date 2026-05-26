import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import BritePaymentProviderService from "./service"

export const BRITE_PROVIDER_ID = "brite"
// Backward-compat alias used by webhook handler
export const BRITE_MODULE_NAME = BRITE_PROVIDER_ID

export default ModuleProvider(Modules.PAYMENT, {
  services: [BritePaymentProviderService],
})
