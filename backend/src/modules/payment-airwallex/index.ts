import { Module } from "@medusajs/framework/utils"
import { AirwallexPaymentProvider } from "./service"

export const AIRWALLEX_MODULE_NAME = "payment_airwallex"

export default Module(AIRWALLEX_MODULE_NAME, {
  service: AirwallexPaymentProvider,
})
