import React from "react"
import { MarketingShell } from "../../../../components/marketing/shared"
import { CampaignEditor } from "../../../../components/marketing/campaign-editor"

function NewCampaignPage() {
  return (
    <MarketingShell
      title="New campaign"
      subtitle="Broadcast to lists and segments"
      active="/marketing/campaigns"
    >
      <CampaignEditor />
    </MarketingShell>
  )
}

export default NewCampaignPage
