import SupportboxService from "./services/supportbox"
import { Module } from "@medusajs/framework/utils"

export const SUPPORTBOX_MODULE = "supportbox"

export default Module(SUPPORTBOX_MODULE, {
  service: SupportboxService,
})
