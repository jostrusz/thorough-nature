import DextrumModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const DEXTRUM_MODULE = "dextrum"

export default Module(DEXTRUM_MODULE, {
  service: DextrumModuleService,
})
