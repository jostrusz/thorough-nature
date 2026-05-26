import BriteBankLogosModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const BRITE_BANK_LOGOS_MODULE = "briteBankLogos"

export default Module(BRITE_BANK_LOGOS_MODULE, {
  service: BriteBankLogosModuleService,
})
