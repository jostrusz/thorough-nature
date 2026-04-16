import React from "react"
import { MarketingShell } from "../../../../components/marketing/shared"
import { TemplateEditor } from "../../../../components/marketing/template-editor"

function NewTemplatePage() {
  return (
    <MarketingShell
      title="New template"
      subtitle="Design and save an email template"
      active="/marketing/templates"
    >
      <TemplateEditor />
    </MarketingShell>
  )
}

export default NewTemplatePage
