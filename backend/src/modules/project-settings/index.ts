import ProjectSettingsModuleService from "./service"
import { Module } from "@medusajs/framework/utils"

export const PROJECT_SETTINGS_MODULE = "projectSettings"

export default Module(PROJECT_SETTINGS_MODULE, {
  service: ProjectSettingsModuleService,
})
