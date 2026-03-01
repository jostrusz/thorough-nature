import ResendConfigModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const RESEND_CONFIG_MODULE = "resendConfig"

export default Module(RESEND_CONFIG_MODULE, {
  service: ResendConfigModuleService,
})
