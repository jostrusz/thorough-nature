import { Module } from "@medusajs/framework/utils"
import { ComgatePaymentProvider } from "./service"

export const COMGATE_MODULE_NAME = "payment-comgate"

export default Module(COMGATE_MODULE_NAME, {
  service: ComgatePaymentProvider,
})
