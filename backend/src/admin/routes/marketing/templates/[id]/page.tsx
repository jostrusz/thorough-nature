import React from "react"
import { useParams } from "react-router-dom"
import { MarketingShell } from "../../../../components/marketing/shared"
import { TemplateEditor } from "../../../../components/marketing/template-editor"

function EditTemplatePage() {
  const params = useParams()
  const id = params.id

  return (
    <MarketingShell
      title="Edit template"
      subtitle="Design and save an email template"
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Templates", to: "/marketing/templates" },
        { label: "Edit" },
      ]}
    >
      <TemplateEditor templateId={id} />
    </MarketingShell>
  )
}

export default EditTemplatePage
