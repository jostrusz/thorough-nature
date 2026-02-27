import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import StripePaymentProviderService from "./service"

export const STRIPE_PROVIDER_ID = "stripe"

export default ModuleProvider(Modules.PAYMENT, {
  services: [StripePaymentProviderService],
})
