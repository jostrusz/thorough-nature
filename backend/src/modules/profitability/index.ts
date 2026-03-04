import ProfitabilityModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PROFITABILITY_MODULE = "profitability"

export default Module(PROFITABILITY_MODULE, {
  service: ProfitabilityModuleService,
})
