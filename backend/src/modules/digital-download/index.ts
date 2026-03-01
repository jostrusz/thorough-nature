import DigitalDownloadModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const DIGITAL_DOWNLOAD_MODULE = "digitalDownload"

export default Module(DIGITAL_DOWNLOAD_MODULE, {
  service: DigitalDownloadModuleService,
})
