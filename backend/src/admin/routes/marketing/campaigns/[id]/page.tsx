import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { MarketingShell } from "../../../../components/marketing/shared"
import { CampaignEditor } from "../../../../components/marketing/campaign-editor"

function EditCampaignPage() {
  const params = useParams()
  const [id, setId] = useState<string | undefined>(params.id)

  useEffect(() => {
    if (!id && typeof window !== "undefined") {
      const m = window.location.hash.match(/#\/marketing\/campaigns\/([^/?#]+)/)
      if (m && m[1] !== "new") setId(m[1])
    }
  }, [id])

  return (
    <MarketingShell
      title="Campaign"
      subtitle="Configure or view campaign"
      active="/marketing/campaigns"
    >
      <CampaignEditor campaignId={id} />
    </MarketingShell>
  )
}

export default EditCampaignPage
