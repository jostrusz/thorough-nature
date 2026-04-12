import MarketingModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const MARKETING_MODULE = "marketing"

export default Module(MARKETING_MODULE, {
  service: MarketingModuleService,
})
