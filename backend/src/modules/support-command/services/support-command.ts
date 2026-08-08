import { MedusaService } from "@medusajs/framework/utils"
import AgentConversation from "../models/agent-conversation"
import AgentMessage from "../models/agent-message"
import AgentTask from "../models/agent-task"
import AgentSetting from "../models/agent-setting"

class SupportCommandService extends MedusaService({
  AgentConversation,
  AgentMessage,
  AgentTask,
  AgentSetting,
}) {}

export default SupportCommandService
