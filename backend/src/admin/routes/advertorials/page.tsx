import React, { useState, useCallback, useMemo } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { sdk } from "../../lib/sdk"
import { colors, radii, shadows, fontStack, btnOutline, btnPrimary } from "../../components/orders/design-tokens"

// ═══════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════

function PageStyles() {
  return (
    <style>{`
      @keyframes advFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .adv-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; }
      .adv-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
      .adv-row { transition: background 0.12s ease; border-radius: 8px; }
      .adv-row:hover { background: #F9FAFB; }
      .adv-btn { transition: all 0.15s ease; cursor: pointer; }
      .adv-btn:hover { background: #F6F6F7 !important; }
      .adv-btn:active { transform: scale(0.97); }
      .adv-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .adv-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(99,91,255,0.25); }
      .adv-input { transition: border-color 0.2s, box-shadow 0.2s; }
      .adv-input:focus { border-color: #635BFF !important; box-shadow: 0 0 0 3px rgba(99,91,255,0.12); outline: none; }
      .adv-section { animation: advFadeIn 0.3s ease; }
      .adv-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 999; display: flex; align-items: center; justify-content: center; }
      .adv-modal { background: #FFF; border-radius: 14px; width: 720px; max-height: 85vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); padding: 28px; }
      .adv-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
      .adv-badge-published { background: #D4EDDA; color: #155724; }
      .adv-badge-draft { background: #FFF3CD; color: #856404; }
      .adv-textarea { font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; font-size: 12px; line-height: 1.5; }
      .adv-textarea:focus { border-color: #635BFF !important; box-shadow: 0 0 0 3px rgba(99,91,255,0.12); outline: none; }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface AdvertorialPage {
  id: string
  project_id: string
  title: string
  slug: string
  html_content: string
  meta_title: string | null
  meta_description: string | null
  og_image_url: string | null
  facebook_pixel_id: string | null
  status: "draft" | "published"
  view_count: number
  created_at: string
  updated_at: string
}

interface ProjectConfig {
  id: string
  project_name: string
  project_slug: string
  flag_emoji: string
  country_tag: string
  domain?: string
}

interface MetaPixelConfig {
  id: string
  project_id: string
  pixel_id: string
  enabled: boolean
}

// ═══════════════════════════════════════════
// SLUG GENERATION (client-side mirror)
// ═══════════════════════════════════════════

function generateSlug(title: string): string {
  let slug = title
  const specialChars: Record<string, string> = {
    "\u0142": "l", "\u0141": "L", "\u00DF": "ss", "\u0111": "d",
    "\u0110": "D", "\u00F8": "o", "\u00D8": "O", "\u00E6": "ae", "\u00C6": "AE",
  }
  for (const [char, replacement] of Object.entries(specialChars)) {
    slug = slug.replace(new RegExp(char, "g"), replacement)
  }
  slug = slug.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  slug = slug.toLowerCase()
  slug = slug.replace(/[^a-z0-9]+/g, "-")
  slug = slug.replace(/-{2,}/g, "-")
  slug = slug.replace(/^-|-$/g, "")
  if (slug.length > 80) {
    slug = slug.substring(0, 80)
    const lastHyphen = slug.lastIndexOf("-")
    if (lastHyphen > 40) slug = slug.substring(0, lastHyphen)
  }
  return slug
}

// ═══════════════════════════════════════════
// SHARED STYLES
// ═══════════════════════════════════════════

const pageStyle: React.CSSProperties = {
  maxWidth: "1100px",
  margin: "0 auto",
  padding: "24px 32px 48px",
  fontFamily: fontStack,
}

const headerStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: "24px",
}

const h1Style: React.CSSProperties = {
  fontSize: "22px",
  fontWeight: 700,
  color: colors.text,
  letterSpacing: "-0.4px",
  display: "flex",
  alignItems: "center",
  gap: "10px",
}

const sectionStyle: React.CSSProperties = {
  background: "#FFF",
  border: `1px solid ${colors.border}`,
  borderRadius: radii.card,
  boxShadow: shadows.card,
  overflow: "hidden",
}

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: `1px solid ${colors.border}`,
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  borderRadius: "8px",
  border: `1px solid ${colors.border}`,
  fontSize: "13px",
  fontFamily: fontStack,
  color: colors.text,
  background: "#FFF",
}

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  appearance: "none" as const,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath d='M3 5l3 3 3-3' stroke='%239CA3B8' fill='none' stroke-width='1.5'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 12px center",
  paddingRight: "32px",
}

const labelStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  color: colors.textSec,
  marginBottom: "4px",
  display: "block",
}

// ═══════════════════════════════════════════
// PAGE ROW COMPONENT
// ═══════════════════════════════════════════

function PageRow({
  page,
  projects,
  onEdit,
  onDelete,
}: {
  page: AdvertorialPage
  projects: ProjectConfig[]
  onEdit: (page: AdvertorialPage) => void
  onDelete: (id: string) => void
}) {
  const project = projects.find((p) => p.project_slug === page.project_id)
  const domain = project?.domain || page.project_id + ".com"
  const fullUrl = `https://${domain}/${page.slug}`

  const handleCopyUrl = useCallback(() => {
    navigator.clipboard.writeText(fullUrl)
    toast.success("URL copied to clipboard")
  }, [fullUrl])

  return (
    <div
      className="adv-row"
      style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span style={{ fontSize: "14px" }}>{project?.flag_emoji || "\u{1F4C4}"}</span>
          <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
            {page.title}
          </span>
        </div>
        <div style={{ fontSize: "12px", color: colors.textMuted, marginBottom: "4px" }}>
          {domain}/{page.slug}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className={`adv-badge adv-badge-${page.status}`}>
            {page.status === "published" ? "\u{1F7E2} Published" : "\u{1F7E1} Draft"}
          </span>
          <span style={{ fontSize: "11px", color: colors.textMuted }}>
            {"\u{1F441}"} {page.view_count} views
          </span>
          <span style={{ fontSize: "11px", color: colors.textMuted }}>
            {page.facebook_pixel_id ? "\u2705 FB Pixel" : "\u2014 No Pixel Override"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <button className="adv-btn" style={{ ...btnOutline, padding: "6px 12px", fontSize: "12px" }} onClick={() => onEdit(page)}>
          Edit
        </button>
        <button className="adv-btn" style={{ ...btnOutline, padding: "6px 12px", fontSize: "12px" }} onClick={handleCopyUrl}>
          Copy URL
        </button>
        <button
          className="adv-btn"
          style={{ ...btnOutline, padding: "6px 12px", fontSize: "12px", color: colors.red, borderColor: "rgba(231,76,60,0.2)" }}
          onClick={() => {
            if (confirm("Delete this advertorial page?")) onDelete(page.id)
          }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// EDIT/CREATE MODAL
// ═══════════════════════════════════════════

function AdvertorialModal({
  page,
  projects,
  pixels,
  onClose,
  onSave,
  isSaving,
}: {
  page: AdvertorialPage | null
  projects: ProjectConfig[]
  pixels: MetaPixelConfig[]
  onClose: () => void
  onSave: (data: Record<string, any>) => void
  isSaving: boolean
}) {
  const isEditing = !!page
  const [title, setTitle] = useState(page?.title || "")
  const [slug, setSlug] = useState(page?.slug || "")
  const [slugEdited, setSlugEdited] = useState(false)
  const [projectId, setProjectId] = useState(page?.project_id || (projects[0]?.project_slug || ""))
  const [htmlContent, setHtmlContent] = useState(page?.html_content || "")
  const [status, setStatus] = useState<"draft" | "published">(page?.status || "draft")
  const [metaTitle, setMetaTitle] = useState(page?.meta_title || "")
  const [metaDescription, setMetaDescription] = useState(page?.meta_description || "")
  const [ogImageUrl, setOgImageUrl] = useState(page?.og_image_url || "")
  const [facebookPixelId, setFacebookPixelId] = useState(page?.facebook_pixel_id || "")
  const [showSeo, setShowSeo] = useState(false)

  const selectedProject = projects.find((p) => p.project_slug === projectId)
  const domain = selectedProject?.domain || projectId + ".com"
  const previewUrl = `https://${domain}/${slug || generateSlug(title)}`

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!slugEdited) {
      setSlug(generateSlug(val))
    }
  }

  const handleSlugChange = (val: string) => {
    setSlugEdited(true)
    setSlug(val.toLowerCase().replace(/[^a-z0-9-]/g, "").replace(/-{2,}/g, "-"))
  }

  const handleSubmit = () => {
    if (!title.trim()) { toast.warning("Title is required"); return }
    if (!projectId) { toast.warning("Project is required"); return }
    const finalSlug = slug || generateSlug(title)
    if (!finalSlug) { toast.warning("Could not generate slug from title"); return }

    const data: Record<string, any> = {
      title,
      slug: finalSlug,
      project_id: projectId,
      html_content: htmlContent,
      status,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      og_image_url: ogImageUrl || null,
      facebook_pixel_id: facebookPixelId || null,
    }

    if (isEditing) data.id = page!.id
    onSave(data)
  }

  const lineCount = htmlContent.split("\n").length

  return (
    <div className="adv-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="adv-modal">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: colors.text, margin: 0 }}>
            {isEditing ? "Edit Advertorial" : "New Advertorial"}
          </h2>
          <button className="adv-btn" style={{ ...btnOutline, padding: "4px 10px", fontSize: "12px" }} onClick={onClose}>
            {"\u2715"}
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Title</label>
          <input
            className="adv-input"
            style={inputStyle}
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="5 důvodů proč psi potřebují kvalitní stravu"
          />
        </div>

        {/* Slug + Project — side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Slug (auto-generated)</label>
            <input
              className="adv-input"
              style={inputStyle}
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="auto-generated-from-title"
            />
          </div>
          <div>
            <label style={labelStyle}>Project (Domain)</label>
            <select className="adv-input" style={selectStyle} value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {projects.map((p) => (
                <option key={p.project_slug} value={p.project_slug}>
                  {p.flag_emoji} {p.project_name} ({p.domain || p.project_slug + ".com"})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* URL Preview */}
        <div style={{ marginBottom: "14px", padding: "8px 12px", background: colors.accentBg, borderRadius: "8px", fontSize: "12px", color: colors.accent, fontWeight: 500 }}>
          {"\u{1F517}"} {previewUrl}
        </div>

        {/* Facebook Pixel + Status — side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Facebook Pixel (optional override)</label>
            <select className="adv-input" style={selectStyle} value={facebookPixelId} onChange={(e) => setFacebookPixelId(e.target.value)}>
              <option value="">Project default</option>
              {pixels.map((p) => (
                <option key={p.id} value={p.pixel_id}>
                  {p.pixel_id} ({p.project_id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select className="adv-input" style={selectStyle} value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
        </div>

        {/* HTML Content */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>
            HTML Content
            <span style={{ fontWeight: 400, color: colors.textMuted, marginLeft: "8px" }}>
              {lineCount} lines
            </span>
          </label>
          <textarea
            className="adv-textarea"
            style={{
              ...inputStyle,
              minHeight: "360px",
              resize: "vertical" as const,
              whiteSpace: "pre" as const,
              overflowWrap: "normal" as const,
              overflowX: "auto" as const,
            }}
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            placeholder="<!DOCTYPE html>\n<html>\n<head>...</head>\n<body>...</body>\n</html>"
            spellCheck={false}
          />
        </div>

        {/* SEO Section (collapsible) */}
        <div style={{ marginBottom: "20px" }}>
          <button
            className="adv-btn"
            style={{
              ...btnOutline,
              padding: "6px 12px",
              fontSize: "12px",
              marginBottom: showSeo ? "12px" : 0,
            }}
            onClick={() => setShowSeo(!showSeo)}
          >
            {showSeo ? "\u25BC" : "\u25B6"} SEO & Social ({showSeo ? "hide" : "show"})
          </button>

          {showSeo && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={labelStyle}>Meta Title</label>
                <input className="adv-input" style={inputStyle} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Custom page title for search engines" />
              </div>
              <div>
                <label style={labelStyle}>Meta Description</label>
                <textarea className="adv-input" style={{ ...inputStyle, minHeight: "60px", resize: "vertical" as const }} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Short description for search results..." />
              </div>
              <div>
                <label style={labelStyle}>OG Image URL</label>
                <input className="adv-input" style={inputStyle} value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)} placeholder="https://cdn.example.com/og-image.jpg" />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="adv-btn" style={btnOutline} onClick={onClose}>
            Cancel
          </button>
          <button className="adv-btn-primary" style={btnPrimary} onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const AdvertorialsPage = () => {
  const queryClient = useQueryClient()
  const [modalPage, setModalPage] = useState<AdvertorialPage | null | "new">(null)
  const [filterProject, setFilterProject] = useState("")
  const [filterStatus, setFilterStatus] = useState("")
  const [showDomains, setShowDomains] = useState(false)
  const [editingDomains, setEditingDomains] = useState<Record<string, string>>({})

  // Fetch advertorial pages
  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ["advertorials", filterProject, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterProject) params.set("project_id", filterProject)
      if (filterStatus) params.set("status", filterStatus)
      const qs = params.toString()
      const response = await sdk.client.fetch<{ pages: AdvertorialPage[] }>(
        `/admin/advertorials${qs ? `?${qs}` : ""}`
      )
      return response
    },
  })

  // Fetch projects for dropdown
  const { data: projectsData } = useQuery({
    queryKey: ["profitability-projects"],
    queryFn: async () => {
      const response = await sdk.client.fetch<{ projects: ProjectConfig[] }>(
        "/admin/profitability/projects"
      )
      return response
    },
  })

  // Fetch pixel configs for dropdown
  const { data: pixelsData } = useQuery({
    queryKey: ["meta-pixels"],
    queryFn: async () => {
      const response = await sdk.client.fetch<{ meta_pixel_configs: MetaPixelConfig[] }>(
        "/admin/meta-pixel"
      )
      return response
    },
  })

  const pages = pagesData?.pages || []
  const projects = projectsData?.projects || []
  const pixels = pixelsData?.meta_pixel_configs || []

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return sdk.client.fetch("/admin/advertorials", {
        method: "POST",
        body: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advertorials"] })
      toast.success("Advertorial created")
      setModalPage(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to create advertorial")
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { id, ...rest } = data
      return sdk.client.fetch(`/admin/advertorials/${id}`, {
        method: "POST",
        body: rest,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advertorials"] })
      toast.success("Advertorial updated")
      setModalPage(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update advertorial")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return sdk.client.fetch(`/admin/advertorials/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["advertorials"] })
      toast.success("Advertorial deleted")
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to delete advertorial")
    },
  })

  // Update project domain mutation
  const updateDomainMutation = useMutation({
    mutationFn: async ({ id, domain }: { id: string; domain: string }) => {
      return sdk.client.fetch(`/admin/profitability/projects/${id}`, {
        method: "POST",
        body: { domain },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profitability-projects"] })
      toast.success("Domain updated")
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to update domain")
    },
  })

  const handleSave = useCallback(
    (data: Record<string, any>) => {
      if (data.id) {
        updateMutation.mutate(data)
      } else {
        createMutation.mutate(data)
      }
    },
    [createMutation, updateMutation]
  )

  return (
    <div style={pageStyle} className="adv-section">
      <PageStyles />

      {/* Header */}
      <div style={headerStyle}>
        <h1 style={h1Style}>
          {"\u{1F4F0}"} Advertorials
        </h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="adv-btn" style={{ ...btnOutline, padding: "8px 16px", fontSize: "13px" }} onClick={() => setShowDomains(!showDomains)}>
            {showDomains ? "Hide Domains" : "Manage Domains"}
          </button>
          <button className="adv-btn-primary" style={btnPrimary} onClick={() => setModalPage("new")}>
            + New Advertorial
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px" }}>
        <select
          className="adv-input"
          style={{ ...selectStyle, width: "220px" }}
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.project_slug} value={p.project_slug}>
              {p.flag_emoji} {p.project_name}
            </option>
          ))}
        </select>
        <select
          className="adv-input"
          style={{ ...selectStyle, width: "160px" }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Domain Management */}
      {showDomains && (
        <div className="adv-card" style={{ ...sectionStyle, marginBottom: "16px" }}>
          <div style={sectionHeaderStyle}>
            <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
              Project Domains
            </span>
          </div>
          <div style={{ padding: "12px 16px" }}>
            {projects.map((p) => {
              const editVal = editingDomains[p.id]
              const currentDomain = editVal !== undefined ? editVal : (p.domain || "")
              const isEditing = editVal !== undefined
              return (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                  <span style={{ fontSize: "13px", minWidth: "180px", color: colors.text }}>
                    {p.flag_emoji} {p.project_name}
                  </span>
                  <input
                    className="adv-input"
                    style={{ ...inputStyle, flex: 1, marginBottom: 0, fontSize: "12px", padding: "6px 10px" }}
                    value={currentDomain}
                    placeholder="example.com"
                    onChange={(e) => setEditingDomains((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  />
                  {isEditing && (
                    <button
                      className="adv-btn-primary"
                      style={{ ...btnPrimary, padding: "6px 14px", fontSize: "11px" }}
                      onClick={() => {
                        updateDomainMutation.mutate({ id: p.id, domain: currentDomain })
                        setEditingDomains((prev) => {
                          const next = { ...prev }
                          delete next[p.id]
                          return next
                        })
                      }}
                    >
                      Save
                    </button>
                  )}
                  <span style={{ fontSize: "11px", color: colors.textMuted, minWidth: "180px" }}>
                    https://{currentDomain || p.project_slug + ".com"}/
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pages List */}
      <div className="adv-card" style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
            Pages ({pages.length})
          </span>
        </div>

        {pagesLoading ? (
          <div style={{ padding: "40px 20px", textAlign: "center" as const, color: colors.textMuted, fontSize: "13px" }}>
            Loading advertorials...
          </div>
        ) : pages.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" as const, color: colors.textMuted, fontSize: "13px" }}>
            No advertorial pages yet. Click "+ New Advertorial" to create one.
          </div>
        ) : (
          pages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              projects={projects}
              onEdit={(p) => setModalPage(p)}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalPage && (
        <AdvertorialModal
          page={modalPage === "new" ? null : modalPage}
          projects={projects}
          pixels={pixels}
          onClose={() => setModalPage(null)}
          onSave={handleSave}
          isSaving={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  )
}

export const config = defineRouteConfig({
  label: "Advertorials",
})

export default AdvertorialsPage
