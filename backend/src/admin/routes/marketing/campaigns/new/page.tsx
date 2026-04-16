import React from "react"
import { MarketingShell } from "../../../../components/marketing/shared"
import { CampaignEditor } from "../../../../components/marketing/campaign-editor"

function NewCampaignPage() {
  return (
    <MarketingShell
      title="New campaign"
      subtitle="Broadcast to lists and segments"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Campaigns", to: "/marketing/campaigns" },
        { label: "New" },
      ]}
    >
      <CampaignEditor />
    </MarketingShell>
  )
}

export default NewCampaignPage
