import { Module } from "@medusajs/framework/utils"
import { Przelewy24PaymentProvider } from "./service"

export const PRZELEWY24_MODULE_NAME = "payment-przelewy24"

export default Module(PRZELEWY24_MODULE_NAME, {
  service: Przelewy24PaymentProvider,
})
