import React, { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import { MarketingShell } from "../../../../components/marketing/shared"
import { TemplateEditor } from "../../../../components/marketing/template-editor"

function EditTemplatePage() {
  const params = useParams()
  const [id, setId] = useState<string | undefined>(params.id)

  // Fallback: pull id from URL hash if router didn't resolve
  useEffect(() => {
    if (!id && typeof window !== "undefined") {
      const m = window.location.hash.match(/#\/marketing\/templates\/([^/?#]+)/)
      if (m && m[1] !== "new") setId(m[1])
    }
  }, [id])

  return (
    <MarketingShell
      title="Edit template"
      subtitle="Design and save an email template"
      active="/marketing/templates"
    >
      <TemplateEditor templateId={id} />
    </MarketingShell>
  )
}

export default EditTemplatePage
