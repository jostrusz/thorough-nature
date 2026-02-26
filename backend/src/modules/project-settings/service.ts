import { MedusaService } from "@medusajs/framework/utils"
import ProjectSettings from "./models/project-settings"

class ProjectSettingsModuleService extends MedusaService({
  ProjectSettings,
}) {}

export default ProjectSettingsModuleService
