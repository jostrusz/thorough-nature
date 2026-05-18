import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import RevolutPaymentProviderService from "./service"

export const REVOLUT_PROVIDER_ID = "revolut"
// Backward-compat alias used by the webhook handler
export const REVOLUT_MODULE_NAME = REVOLUT_PROVIDER_ID

export default ModuleProvider(Modules.PAYMENT, {
  services: [RevolutPaymentProviderService],
})
