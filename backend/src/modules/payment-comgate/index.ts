import { Module } from "@medusajs/framework/utils"
import { ComgatePaymentProvider } from "./service"

export const COMGATE_MODULE_NAME = "payment_comgate"

export default Module(COMGATE_MODULE_NAME, {
  service: ComgatePaymentProvider,
})
