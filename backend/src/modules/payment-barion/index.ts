// @ts-nocheck
import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import BarionPaymentProviderService from "./service"

export const BARION_PROVIDER_ID = "barion"
// Alias used by the webhook handler for consistency with other providers.
export const BARION_MODULE_NAME = BARION_PROVIDER_ID

export default ModuleProvider(Modules.PAYMENT, {
  services: [BarionPaymentProviderService],
})
