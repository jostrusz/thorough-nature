import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import KlarnaPaymentProviderService from "./service"

export const KLARNA_PROVIDER_ID = "klarna"

export default ModuleProvider(Modules.PAYMENT, {
  services: [KlarnaPaymentProviderService],
})
