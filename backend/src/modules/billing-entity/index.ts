import BillingEntityModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const BILLING_ENTITY_MODULE = "billingEntity"

export default Module(BILLING_ENTITY_MODULE, {
  service: BillingEntityModuleService,
})
