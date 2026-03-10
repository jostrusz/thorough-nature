import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import { Przelewy24PaymentProvider } from "./service"

export const PRZELEWY24_PROVIDER_ID = "przelewy24"

export default ModuleProvider(Modules.PAYMENT, {
  services: [Przelewy24PaymentProvider],
})
