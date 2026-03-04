import { MedusaService } from "@medusajs/framework/utils"
import ProjectConfig from "./models/project-config"
import MetaAdsConfig from "./models/meta-ads-config"
import DailyProjectStats from "./models/daily-project-stats"

class ProfitabilityModuleService extends MedusaService({
  ProjectConfig,
  MetaAdsConfig,
  DailyProjectStats,
}) {}

export default ProfitabilityModuleService
