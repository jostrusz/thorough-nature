import { Module } from "@medusajs/framework/utils"
import { KlarnaPaymentProvider } from "./service"

export const KLARNA_MODULE_NAME = "payment-klarna"

export default Module(KLARNA_MODULE_NAME, {
  service: KlarnaPaymentProvider,
})
