import React from "react"
import { useParams } from "react-router-dom"
import { MarketingShell } from "../../../../components/marketing/shared"
import { FlowEditor } from "../../../../components/marketing/flow-editor"

function EditFlowPage() {
  const params = useParams()
  const id = params.id

  return (
    <MarketingShell
      title="Flow"
      subtitle="Automation editor"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Flows", to: "/marketing/flows" },
        { label: "Detail" },
      ]}
    >
      <FlowEditor flowId={id} />
    </MarketingShell>
  )
}

export default EditFlowPage
