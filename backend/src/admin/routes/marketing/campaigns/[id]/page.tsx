import React from "react"
import { useParams } from "react-router-dom"
import { MarketingShell } from "../../../../components/marketing/shared"
import { CampaignEditor } from "../../../../components/marketing/campaign-editor"

function EditCampaignPage() {
  const params = useParams()
  const id = params.id

  return (
    <MarketingShell
      title="Campaign"
      subtitle="Configure or view campaign"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Campaigns", to: "/marketing/campaigns" },
        { label: "Detail" },
      ]}
    >
      <CampaignEditor campaignId={id} />
    </MarketingShell>
  )
}

export default EditCampaignPage
