import { MedusaService } from "@medusajs/framework/utils"
import MarketingBrand from "./models/brand"
import MarketingContact from "./models/contact"
import MarketingList from "./models/list"
import MarketingListMembership from "./models/list-membership"
import MarketingSegment from "./models/segment"
import MarketingTemplate from "./models/template"
import MarketingTemplateVersion from "./models/template-version"
import MarketingCampaign from "./models/campaign"
import MarketingFlow from "./models/flow"
import MarketingFlowRun from "./models/flow-run"
import MarketingEvent from "./models/event"
import MarketingMessage from "./models/message"
import MarketingSuppression from "./models/suppression"
import MarketingForm from "./models/form"
import MarketingConsentLog from "./models/consent-log"
import MarketingAiJob from "./models/ai-job"
import MarketingAttribution from "./models/attribution"

class MarketingModuleService extends MedusaService({
  MarketingBrand,
  MarketingContact,
  MarketingList,
  MarketingListMembership,
  MarketingSegment,
  MarketingTemplate,
  MarketingTemplateVersion,
  MarketingCampaign,
  MarketingFlow,
  MarketingFlowRun,
  MarketingEvent,
  MarketingMessage,
  MarketingSuppression,
  MarketingForm,
  MarketingConsentLog,
  MarketingAiJob,
  MarketingAttribution,
}) {}

export default MarketingModuleService
