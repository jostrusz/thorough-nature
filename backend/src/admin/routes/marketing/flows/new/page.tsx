import React from "react"
import { MarketingShell } from "../../../../components/marketing/shared"
import { FlowEditor } from "../../../../components/marketing/flow-editor"

function NewFlowPage() {
  return (
    <MarketingShell
      title="New flow"
      subtitle="Configure trigger and node sequence"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Flows", to: "/marketing/flows" },
        { label: "New" },
      ]}
    >
      <FlowEditor />
    </MarketingShell>
  )
}

export default NewFlowPage
