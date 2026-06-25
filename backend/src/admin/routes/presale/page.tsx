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
      @keyframes psFadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
      .ps-card { transition: box-shadow 0.25s ease, border-color 0.25s ease; }
      .ps-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
      .ps-row { transition: background 0.12s ease; }
      .ps-row:hover { background: #F9FAFB; }
      .ps-btn { transition: all 0.15s ease; cursor: pointer; }
      .ps-btn:hover { background: #F6F6F7 !important; }
      .ps-btn:active { transform: scale(0.97); }
      .ps-btn-primary { transition: all 0.15s ease; cursor: pointer; }
      .ps-btn-primary:hover { filter: brightness(1.1); box-shadow: 0 2px 8px rgba(108,92,231,0.25); }
      .ps-input { transition: border-color 0.2s, box-shadow 0.2s; }
      .ps-input:focus { border-color: #6C5CE7 !important; box-shadow: 0 0 0 3px rgba(108,92,231,0.12); outline: none; }
      .ps-section { animation: psFadeIn 0.3s ease; }
      .ps-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.4); z-index: 999; display: flex; align-items: center; justify-content: center; }
      .ps-modal { background: #FFF; border-radius: 14px; width: 1180px; max-width: 96vw; max-height: 92vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.2); padding: 28px; }
      .ps-badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; white-space: nowrap; }
      .ps-badge-published { background: #D4EDDA; color: #155724; }
      .ps-badge-draft { background: #FFF3CD; color: #856404; }
      .ps-badge-domain { background: #EEF0FF; color: #4338CA; }
      .ps-textarea { font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace; font-size: 12px; line-height: 1.5; }
      .ps-textarea:focus { border-color: #6C5CE7 !important; box-shadow: 0 0 0 3px rgba(108,92,231,0.12); outline: none; }
      .ps-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    `}</style>
  )
}

// ═══════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════

interface PresalePage {
  id: string
  domain: string
  slug: string
  title: string
  title_cs: string | null
  type: string
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
    "ł": "l", "Ł": "L", "ß": "ss", "đ": "d",
    "Đ": "D", "ø": "o", "Ø": "O", "æ": "ae", "Æ": "AE",
  }
  for (const [char, replacement] of Object.entries(specialChars)) {
    slug = slug.replace(new RegExp(char, "g"), replacement)
  }
  slug = slug.normalize("NFD").replace(/[̀-ͯ]/g, "")
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

const CUSTOM_DOMAIN = "__custom__"

// ═══════════════════════════════════════════
// PAGE ROW COMPONENT (stacked rows, not grid)
// ═══════════════════════════════════════════

function PageRow({
  page,
  onEdit,
  onDuplicate,
  onPreview,
  onDelete,
}: {
  page: PresalePage
  onEdit: (page: PresalePage) => void
  onDuplicate: (page: PresalePage) => void
  onPreview: (page: PresalePage) => void
  onDelete: (id: string) => void
}) {
  return (
    <div
      className="ps-row"
      style={{
        padding: "14px 20px",
        borderBottom: `1px solid ${colors.border}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      {/* LEFT: domain badge + status + title + cs translation + meta */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
          <span className="ps-badge ps-badge-domain">{"\u{1F310}"} {page.domain || "no-domain"}</span>
          <span className={`ps-badge ps-badge-${page.status}`}>
            {page.status === "published" ? "\u{1F7E2} Published" : "\u{1F7E1} Draft"}
          </span>
        </div>
        <div className="ps-ellipsis" style={{ fontSize: "14px", fontWeight: 600, color: colors.text, maxWidth: "560px" }}>
          {page.title || "(bez názvu)"}
        </div>
        <div
          className="ps-ellipsis"
          style={{
            fontSize: "12px",
            color: page.title_cs ? colors.textSec : colors.textMuted,
            fontStyle: page.title_cs ? "normal" : "italic",
            maxWidth: "560px",
            marginTop: "1px",
          }}
        >
          {page.title_cs || "— bez překladu"}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
          <span className="ps-ellipsis" style={{ fontSize: "11px", color: colors.textMuted, maxWidth: "420px" }}>
            {page.domain}/{page.slug}
          </span>
          <span style={{ fontSize: "11px", color: colors.textMuted, flexShrink: 0 }}>
            {"\u{1F441}"} {page.view_count ?? 0} views
          </span>
        </div>
      </div>

      {/* RIGHT: actions */}
      <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
        <button className="ps-btn" style={{ ...btnOutline, padding: "6px 12px", fontSize: "12px" }} onClick={() => onEdit(page)}>
          Upravit
        </button>
        <button className="ps-btn" style={{ ...btnOutline, padding: "6px 12px", fontSize: "12px" }} onClick={() => onDuplicate(page)}>
          Duplikovat
        </button>
        <button className="ps-btn" style={{ ...btnOutline, padding: "6px 12px", fontSize: "12px" }} onClick={() => onPreview(page)}>
          Náhled
        </button>
        <button
          className="ps-btn"
          style={{ ...btnOutline, padding: "6px 12px", fontSize: "12px", color: colors.red, borderColor: "rgba(231,76,60,0.2)" }}
          onClick={() => {
            if (confirm("Smazat tuto presale stránku?")) onDelete(page.id)
          }}
        >
          Smazat
        </button>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// EDIT/CREATE MODAL (split-view editor)
// ═══════════════════════════════════════════

function PresaleModal({
  page,
  projects,
  pixels,
  onClose,
  onSave,
  isSaving,
}: {
  page: PresalePage | null
  projects: ProjectConfig[]
  pixels: MetaPixelConfig[]
  onClose: () => void
  onSave: (data: Record<string, any>) => void
  isSaving: boolean
}) {
  const isEditing = !!page

  // Known domains from projects (only those that have one)
  const projectDomains = useMemo(
    () => projects.filter((p) => p.domain).map((p) => p.domain as string),
    [projects]
  )

  const initialDomain = page?.domain || projectDomains[0] || ""
  const initialDomainKnown = !page?.domain || projectDomains.includes(page.domain)

  const [title, setTitle] = useState(page?.title || "")
  const [titleCs, setTitleCs] = useState(page?.title_cs || "")
  const [slug, setSlug] = useState(page?.slug || "")
  const [slugEdited, setSlugEdited] = useState(!!page?.slug)
  // domainSelect holds the dropdown value (a known domain, or CUSTOM_DOMAIN)
  const [domainSelect, setDomainSelect] = useState(initialDomainKnown ? initialDomain : CUSTOM_DOMAIN)
  const [customDomain, setCustomDomain] = useState(initialDomainKnown ? "" : (page?.domain || ""))
  const [type, setType] = useState(page?.type || "listicle")
  const [htmlContent, setHtmlContent] = useState(page?.html_content || "")
  const [status, setStatus] = useState<"draft" | "published">(page?.status || "draft")
  const [metaTitle, setMetaTitle] = useState(page?.meta_title || "")
  const [metaDescription, setMetaDescription] = useState(page?.meta_description || "")
  const [ogImageUrl, setOgImageUrl] = useState(page?.og_image_url || "")
  const [facebookPixelId, setFacebookPixelId] = useState(page?.facebook_pixel_id || "")
  const [showSeo, setShowSeo] = useState(false)
  const [translating, setTranslating] = useState(false)

  const effectiveDomain = domainSelect === CUSTOM_DOMAIN ? customDomain : domainSelect
  const previewUrl = `https://${effectiveDomain || "domain.com"}/${slug || generateSlug(title)}`

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

  const handleTranslate = useCallback(async () => {
    if (!title.trim()) {
      toast.warning("Nejprve vyplň anglický/originální titulek")
      return
    }
    setTranslating(true)
    try {
      const resp = await sdk.client.fetch<{ translation: string }>("/admin/presale/translate", {
        method: "POST",
        body: { title, target_lang: "cs" },
      })
      if (resp?.translation) {
        setTitleCs(resp.translation)
        toast.success("Přeloženo (Haiku)")
      } else {
        toast.error("Překlad se nevrátil")
      }
    } catch (err: any) {
      toast.error(err?.message || "Překlad selhal")
    } finally {
      setTranslating(false)
    }
  }, [title])

  const handleSubmit = () => {
    if (!title.trim()) { toast.warning("Titulek je povinný"); return }
    if (!effectiveDomain.trim()) { toast.warning("Doména je povinná"); return }
    const finalSlug = slug || generateSlug(title)
    if (!finalSlug) { toast.warning("Nepodařilo se vygenerovat slug z titulku"); return }

    const data: Record<string, any> = {
      domain: effectiveDomain.trim(),
      slug: finalSlug,
      title,
      title_cs: titleCs || null,
      type: type || "listicle",
      html_content: htmlContent,
      meta_title: metaTitle || null,
      meta_description: metaDescription || null,
      og_image_url: ogImageUrl || null,
      facebook_pixel_id: facebookPixelId || null,
      status,
    }

    if (isEditing) data.id = page!.id
    onSave(data)
  }

  const lineCount = htmlContent.split("\n").length

  return (
    <div className="ps-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="ps-modal">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "20px" }}>
          <h2 style={{ fontSize: "18px", fontWeight: 700, color: colors.text, margin: 0 }}>
            {isEditing ? "Upravit presale" : "Nová presale stránka"}
          </h2>
          <button className="ps-btn" style={{ ...btnOutline, padding: "4px 10px", fontSize: "12px" }} onClick={onClose}>
            {"✕"}
          </button>
        </div>

        {/* Title */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Titulek</label>
          <input
            className="ps-input"
            style={inputStyle}
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="5 reasons why letting go changes everything"
          />
        </div>

        {/* Title CS + Translate button */}
        <div style={{ marginBottom: "14px" }}>
          <label style={labelStyle}>Titulek (CZ překlad)</label>
          <div style={{ display: "flex", gap: "8px", alignItems: "stretch" }}>
            <input
              className="ps-input"
              style={{ ...inputStyle, flex: 1 }}
              value={titleCs}
              onChange={(e) => setTitleCs(e.target.value)}
              placeholder="Český překlad nadpisu (interní)"
            />
            <button
              className="ps-btn"
              style={{ ...btnOutline, padding: "8px 14px", fontSize: "12px", whiteSpace: "nowrap" as const, flexShrink: 0 }}
              onClick={handleTranslate}
              disabled={translating}
            >
              {translating ? "Překládám..." : "Přeložit (Haiku)"}
            </button>
          </div>
        </div>

        {/* Slug + Type — side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Slug (auto z titulku)</label>
            <input
              className="ps-input"
              style={inputStyle}
              value={slug}
              onChange={(e) => handleSlugChange(e.target.value)}
              placeholder="auto-generated-from-title"
            />
          </div>
          <div>
            <label style={labelStyle}>Typ</label>
            <input
              className="ps-input"
              style={inputStyle}
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="listicle"
            />
          </div>
        </div>

        {/* Domain dropdown (+ custom) + Pixel — side by side */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
          <div>
            <label style={labelStyle}>Doména</label>
            <select
              className="ps-input"
              style={selectStyle}
              value={domainSelect}
              onChange={(e) => setDomainSelect(e.target.value)}
            >
              {projectDomains.map((d) => {
                const proj = projects.find((p) => p.domain === d)
                return (
                  <option key={d} value={d}>
                    {proj?.flag_emoji ? `${proj.flag_emoji} ` : ""}{d}
                  </option>
                )
              })}
              <option value={CUSTOM_DOMAIN}>{"➕"} Vlastní doména…</option>
            </select>
            {domainSelect === CUSTOM_DOMAIN && (
              <input
                className="ps-input"
                style={{ ...inputStyle, marginTop: "8px" }}
                value={customDomain}
                onChange={(e) =>
                  setCustomDomain(e.target.value.toLowerCase().replace(/[^a-z0-9.\-]/g, ""))
                }
                placeholder="example.com"
              />
            )}
          </div>
          <div>
            <label style={labelStyle}>Facebook Pixel (override)</label>
            <select className="ps-input" style={selectStyle} value={facebookPixelId} onChange={(e) => setFacebookPixelId(e.target.value)}>
              <option value="">Project default</option>
              {pixels.map((p) => (
                <option key={p.id} value={p.pixel_id}>
                  {p.pixel_id} ({p.project_id})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status + URL preview */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", marginBottom: "14px", alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Status</label>
            <select className="ps-input" style={selectStyle} value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </div>
          <div style={{ padding: "8px 12px", background: colors.accentBg, borderRadius: "8px", fontSize: "12px", color: colors.accent, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
            {"\u{1F517}"} {previewUrl}
          </div>
        </div>

        {/* SPLIT VIEW: editor (left) + live iframe preview (right) */}
        <div style={{ marginBottom: "16px" }}>
          <label style={labelStyle}>
            HTML obsah
            <span style={{ fontWeight: 400, color: colors.textMuted, marginLeft: "8px" }}>
              {lineCount} lines · živý náhled vpravo
            </span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <textarea
              className="ps-textarea"
              style={{
                ...inputStyle,
                height: "440px",
                resize: "vertical" as const,
                whiteSpace: "pre" as const,
                overflowWrap: "normal" as const,
                overflowX: "auto" as const,
              }}
              value={htmlContent}
              onChange={(e) => setHtmlContent(e.target.value)}
              placeholder={"<!DOCTYPE html>\n<html>\n<head>...</head>\n<body>...</body>\n</html>"}
              spellCheck={false}
            />
            <div style={{ border: `1px solid ${colors.border}`, borderRadius: "8px", overflow: "hidden", background: "#FFF" }}>
              <iframe
                title="presale-preview"
                srcDoc={htmlContent}
                sandbox="allow-same-origin"
                style={{ width: "100%", height: "440px", border: "none", background: "#FFF" }}
              />
            </div>
          </div>
        </div>

        {/* SEO Section (collapsible) */}
        <div style={{ marginBottom: "20px" }}>
          <button
            className="ps-btn"
            style={{
              ...btnOutline,
              padding: "6px 12px",
              fontSize: "12px",
              marginBottom: showSeo ? "12px" : 0,
            }}
            onClick={() => setShowSeo(!showSeo)}
          >
            {showSeo ? "▼" : "▶"} SEO & Social ({showSeo ? "skrýt" : "zobrazit"})
          </button>

          {showSeo && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div>
                <label style={labelStyle}>Meta Title</label>
                <input className="ps-input" style={inputStyle} value={metaTitle} onChange={(e) => setMetaTitle(e.target.value)} placeholder="Custom page title for search engines" />
              </div>
              <div>
                <label style={labelStyle}>Meta Description</label>
                <textarea className="ps-input" style={{ ...inputStyle, minHeight: "60px", resize: "vertical" as const }} value={metaDescription} onChange={(e) => setMetaDescription(e.target.value)} placeholder="Short description for search results..." />
              </div>
              <div>
                <label style={labelStyle}>OG Image URL</label>
                <input className="ps-input" style={inputStyle} value={ogImageUrl} onChange={(e) => setOgImageUrl(e.target.value)} placeholder="https://cdn.example.com/og-image.jpg" />
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button className="ps-btn" style={btnOutline} onClick={onClose}>
            Zrušit
          </button>
          <button className="ps-btn-primary" style={btnPrimary} onClick={handleSubmit} disabled={isSaving}>
            {isSaving ? "Ukládám..." : isEditing ? "Uložit" : "Vytvořit"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════

const PresalePageRoute = () => {
  const queryClient = useQueryClient()
  const [modalPage, setModalPage] = useState<PresalePage | null | "new">(null)
  const [search, setSearch] = useState("")
  const [filterDomain, setFilterDomain] = useState("")
  const [filterStatus, setFilterStatus] = useState("")

  // Fetch presale pages (server filters by domain + status)
  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ["presale", filterDomain, filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (filterDomain) params.set("domain", filterDomain)
      if (filterStatus) params.set("status", filterStatus)
      const qs = params.toString()
      return sdk.client.fetch<{ pages: PresalePage[] }>(
        `/admin/presale${qs ? `?${qs}` : ""}`
      )
    },
  })

  // Fetch projects for domain dropdown
  const { data: projectsData } = useQuery({
    queryKey: ["profitability-projects"],
    queryFn: async () => {
      return sdk.client.fetch<{ projects: ProjectConfig[] }>(
        "/admin/profitability/projects"
      )
    },
  })

  // Fetch pixel configs for dropdown
  const { data: pixelsData } = useQuery({
    queryKey: ["meta-pixels"],
    queryFn: async () => {
      return sdk.client.fetch<{ meta_pixel_configs: MetaPixelConfig[] }>(
        "/admin/meta-pixel"
      )
    },
  })

  const allPages = pagesData?.pages || []
  const projects = projectsData?.projects || []
  const pixels = pixelsData?.meta_pixel_configs || []

  // Domains for the filter dropdown — known project domains + any domain seen on pages
  const domainOptions = useMemo(() => {
    const set = new Set<string>()
    projects.forEach((p) => { if (p.domain) set.add(p.domain) })
    allPages.forEach((p) => { if (p.domain) set.add(p.domain) })
    return Array.from(set).sort()
  }, [projects, allPages])

  // Client-side fulltext filter on title / title_cs / slug
  const pages = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allPages
    return allPages.filter((p) =>
      (p.title || "").toLowerCase().includes(q) ||
      (p.title_cs || "").toLowerCase().includes(q) ||
      (p.slug || "").toLowerCase().includes(q)
    )
  }, [allPages, search])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      return sdk.client.fetch("/admin/presale", {
        method: "POST",
        body: data,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presale"] })
      toast.success("Presale stránka vytvořena")
      setModalPage(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || "Vytvoření selhalo")
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: Record<string, any>) => {
      const { id, ...rest } = data
      return sdk.client.fetch(`/admin/presale/${id}`, {
        method: "POST",
        body: rest,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presale"] })
      toast.success("Presale stránka uložena")
      setModalPage(null)
    },
    onError: (err: any) => {
      toast.error(err?.message || "Uložení selhalo")
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return sdk.client.fetch(`/admin/presale/${id}`, {
        method: "DELETE",
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presale"] })
      toast.success("Presale stránka smazána")
    },
    onError: (err: any) => {
      toast.error(err?.message || "Smazání selhalo")
    },
  })

  // Duplicate mutation
  const duplicateMutation = useMutation({
    mutationFn: async (page: PresalePage) => {
      return sdk.client.fetch(`/admin/presale/${page.id}/duplicate`, {
        method: "POST",
        body: {},
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["presale"] })
      toast.success("Presale stránka zduplikována")
    },
    onError: (err: any) => {
      toast.error(err?.message || "Duplikace selhala")
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

  const handlePreview = useCallback((page: PresalePage) => {
    // Published → open the live URL; otherwise the server preview endpoint.
    if (page.status === "published" && page.domain) {
      window.open(`https://${page.domain}/${page.slug}`, "_blank", "noopener,noreferrer")
    } else {
      window.open(`/admin/presale/${page.id}/preview`, "_blank", "noopener,noreferrer")
    }
  }, [])

  return (
    <div style={pageStyle} className="ps-section">
      <PageStyles />

      {/* Header */}
      <div style={headerStyle}>
        <h1 style={h1Style}>
          {"\u{1F680}"} Presale
        </h1>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="ps-btn-primary" style={btnPrimary} onClick={() => setModalPage("new")}>
            + Nový
          </button>
        </div>
      </div>

      {/* Filter bar: search + domain + status */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "16px", flexWrap: "wrap" as const }}>
        <input
          className="ps-input"
          style={{ ...inputStyle, width: "280px" }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={"\u{1F50D} Hledat titulek / slug…"}
        />
        <select
          className="ps-input"
          style={{ ...selectStyle, width: "240px" }}
          value={filterDomain}
          onChange={(e) => setFilterDomain(e.target.value)}
        >
          <option value="">Všechny domény</option>
          {domainOptions.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select
          className="ps-input"
          style={{ ...selectStyle, width: "160px" }}
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="">Všechny statusy</option>
          <option value="published">Published</option>
          <option value="draft">Draft</option>
        </select>
      </div>

      {/* Pages List — stacked rows */}
      <div className="ps-card" style={sectionStyle}>
        <div style={sectionHeaderStyle}>
          <span style={{ fontSize: "14px", fontWeight: 600, color: colors.text }}>
            Stránky ({pages.length})
          </span>
        </div>

        {pagesLoading ? (
          <div style={{ padding: "40px 20px", textAlign: "center" as const, color: colors.textMuted, fontSize: "13px" }}>
            Načítám presale stránky...
          </div>
        ) : pages.length === 0 ? (
          <div style={{ padding: "40px 20px", textAlign: "center" as const, color: colors.textMuted, fontSize: "13px" }}>
            {allPages.length === 0
              ? 'Zatím žádné presale stránky. Klikni na "+ Nový" pro vytvoření.'
              : "Žádná stránka neodpovídá filtru."}
          </div>
        ) : (
          pages.map((page) => (
            <PageRow
              key={page.id}
              page={page}
              onEdit={(p) => setModalPage(p)}
              onDuplicate={(p) => duplicateMutation.mutate(p)}
              onPreview={handlePreview}
              onDelete={(id) => deleteMutation.mutate(id)}
            />
          ))
        )}
      </div>

      {/* Create/Edit Modal */}
      {modalPage && (
        <PresaleModal
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
  label: "Presale",
})

export default PresalePageRoute
