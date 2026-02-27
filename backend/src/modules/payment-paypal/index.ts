import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import PayPalPaymentProviderService from "./service"

export const PAYPAL_PROVIDER_ID = "paypal"

export default ModuleProvider(Modules.PAYMENT, {
  services: [PayPalPaymentProviderService],
})
