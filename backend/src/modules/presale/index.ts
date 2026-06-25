import { Module } from "@medusajs/framework/utils"
import PresaleModuleService from "./service"

export const PRESALE_MODULE = "presale"

export default Module(PRESALE_MODULE, {
  service: PresaleModuleService,
})
