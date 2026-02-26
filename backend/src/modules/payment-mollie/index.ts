import { Module } from "@medusajs/framework/utils"
import { MolliePaymentProvider } from "./service"

export const MOLLIE_MODULE_NAME = "payment_mollie"

export default Module(MOLLIE_MODULE_NAME, {
  service: MolliePaymentProvider,
})
