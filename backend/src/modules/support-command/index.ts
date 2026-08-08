import SupportCommandService from "./services/support-command"
import { Module } from "@medusajs/framework/utils"

export const SUPPORT_COMMAND_MODULE = "supportCommand"

export default Module(SUPPORT_COMMAND_MODULE, {
  service: SupportCommandService,
})
