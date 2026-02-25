import GatewayConfigModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const GATEWAY_CONFIG_MODULE = "gatewayConfig"

export default Module(GATEWAY_CONFIG_MODULE, {
  service: GatewayConfigModuleService,
})
