import { Module } from "@medusajs/framework/utils"
import AdvertorialModuleService from "./service"

export const ADVERTORIAL_MODULE = "advertorial"

export default Module(ADVERTORIAL_MODULE, {
  service: AdvertorialModuleService,
})
