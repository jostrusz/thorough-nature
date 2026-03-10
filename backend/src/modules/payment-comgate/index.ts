import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { ComgatePaymentProvider } from "./service"

export const COMGATE_PROVIDER_ID = "comgate"

export default ModuleProvider(Modules.PAYMENT, {
  services: [ComgatePaymentProvider],
})
