import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { MarketingShell } from "../../../../components/marketing/shared"
import { FlowEditor } from "../../../../components/marketing/flow-editor"

function EditFlowPage() {
  const params = useParams()
  const [id, setId] = useState<string | undefined>(params.id)

  useEffect(() => {
    if (!id && typeof window !== "undefined") {
      const m = window.location.hash.match(/#\/marketing\/flows\/([^/?#]+)/)
      if (m && m[1] !== "new") setId(m[1])
    }
  }, [id])

  return (
    <MarketingShell
      title="Flow"
      subtitle="Automation editor"
      active="/marketing/flows"
    >
      <FlowEditor flowId={id} />
    </MarketingShell>
  )
}

export default EditFlowPage
