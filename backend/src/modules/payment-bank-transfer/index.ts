import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import BankTransferPaymentProviderService from "./service"

export const BANK_TRANSFER_PROVIDER_ID = "bank_transfer"

export default ModuleProvider(Modules.PAYMENT, {
  services: [BankTransferPaymentProviderService],
})
