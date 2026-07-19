import { Module } from "@medusajs/framework/utils"
import AdsLibraryService from "./service"

export const ADS_LIBRARY_MODULE = "adsLibrary"

export default Module(ADS_LIBRARY_MODULE, {
  service: AdsLibraryService,
})
