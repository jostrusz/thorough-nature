import FakturoidModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const FAKTUROID_MODULE = "fakturoid"

export default Module(FAKTUROID_MODULE, {
  service: FakturoidModuleService,
})
