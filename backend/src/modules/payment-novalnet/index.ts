import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import NovalnetPaymentProviderService from "./service"

export const NOVALNET_PROVIDER_ID = "novalnet"
// Backwards-compat alias used by webhook handler / matcher
export const NOVALNET_MODULE_NAME = NOVALNET_PROVIDER_ID

export default ModuleProvider(Modules.PAYMENT, {
  services: [NovalnetPaymentProviderService],
})
