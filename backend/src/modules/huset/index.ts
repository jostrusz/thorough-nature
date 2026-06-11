import HusetModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const HUSET_MODULE = "huset"

export default Module(HUSET_MODULE, {
  service: HusetModuleService,
})
