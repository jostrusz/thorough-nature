import { Module } from "@medusajs/framework/utils"
import PaymentDebugService from "./service"

export const PAYMENT_DEBUG_MODULE = "paymentDebug"

export default Module(PAYMENT_DEBUG_MODULE, {
  service: PaymentDebugService,
})
