import { MedusaService } from "@medusajs/framework/utils"
import PageView from "./models/page-view"
import ConversionEvent from "./models/conversion-event"
import VisitorSession from "./models/visitor-session"
import EmailCampaign from "./models/email-campaign"
import EmailConversion from "./models/email-conversion"
import CustomerJourney from "./models/customer-journey"

class AnalyticsModuleService extends MedusaService({
  PageView,
  ConversionEvent,
  VisitorSession,
  EmailCampaign,
  EmailConversion,
  CustomerJourney,
}) {}

export default AnalyticsModuleService
