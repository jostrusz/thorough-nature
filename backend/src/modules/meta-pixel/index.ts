import MetaPixelModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const META_PIXEL_MODULE = "metaPixel"

export default Module(META_PIXEL_MODULE, {
  service: MetaPixelModuleService,
})
