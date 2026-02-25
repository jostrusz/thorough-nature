import QuickBooksModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const QUICKBOOKS_MODULE = "quickbooks"

export default Module(QUICKBOOKS_MODULE, {
  service: QuickBooksModuleService,
})
