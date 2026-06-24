import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { sdk } from "../../lib/sdk"
import { useSelectedBrand, StatusBadge, brandQs, fmt, tokens, Modal } from "./shared"
import {
  BlockBuilder,
  compileBlocksToHtml,
  type EmailBlock,
} from "./email-blocks"
import { EMAIL_TEMPLATES } from "./email-templates"

/**
 * Campaign editor — tabbed layout.
 *
 *   Tab "Content"        — name, subject, preheader, sender, reply-to,
 *                          and the EMAIL BUILDER (Blocks / HTML / Preview).
 *   Tab "Recipients"     — lists, segments, suppression, live count, preview.
 *   Tab "Schedule & send"— schedule time + timezone info.
 *
 * The Actions sidebar (Save / Test / Schedule / Send now) is sticky and shown
 * from every tab.
 *
 * Email authoring:
 *   - Visual block builder is the friendly default. Blocks live in
 *     campaign.metadata.blocks (JSON) and COMPILE to `custom_html` on change.
 *   - `custom_html` is still the single source of truth that gets sent.
 *   - HTML mode is the expert escape hatch; editing raw HTML detaches from
 *     blocks ("custom HTML") so the compiler won't clobber the user's edits.
 */
export function CampaignEditor({ campaignId }: { campaignId?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { brandId, setBrandId } = useSelectedBrand()
  const bQs = brandQs(brandId)

  const [currentId, setCurrentId] = useState<string | undefined>(campaignId)
  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [fromName, setFromName] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [customHtml, setCustomHtml] = useState("")
  const [listIds, setListIds] = useState<string[]>([])
  const [segmentIds, setSegmentIds] = useState<string[]>([])
  const [suppressionSegmentIds, setSuppressionSegmentIds] = useState<string[]>([])
  const [scheduleAt, setScheduleAt] = useState("")
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null)
  const [status, setStatus] = useState<string>("draft")
  const [sentAt, setSentAt] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>({})
  const [brand, setBrand] = useState<any>(null)

  // Email builder state
  const [blocks, setBlocks] = useState<EmailBlock[]>([])
  // "blocks" → visual builder drives custom_html; "html" → raw HTML is source.
  const [emailMode, setEmailMode] = useState<"blocks" | "html">("html")
  const [emailView, setEmailView] = useState<"edit" | "preview">("edit")

  // A/B test subject line. `subject` is always variant A; abVariants holds the
  // extra variants (B, C, D). On save we persist {enabled, variants:[subject,...]}.
  const [abEnabled, setAbEnabled] = useState(false)
  const [abVariants, setAbVariants] = useState<string[]>([])

  // Tabs
  const [tab, setTab] = useState<"content" | "recipients" | "schedule">("content")

  // Dirty tracking — compare a normalized snapshot to the last-saved one.
  const savedSnapshot = useRef<string>("")
  const [dirty, setDirty] = useState(false)
  const [hydrated, setHydrated] = useState(!campaignId) // new campaigns start hydrated

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        name, subject, preheader, fromName, fromEmail, replyTo, customHtml,
        listIds, segmentIds, suppressionSegmentIds, scheduleAt,
        blocks, emailMode, abEnabled, abVariants,
      }),
    [name, subject, preheader, fromName, fromEmail, replyTo, customHtml, listIds, segmentIds, suppressionSegmentIds, scheduleAt, blocks, emailMode, abEnabled, abVariants]
  )
  useEffect(() => {
    if (!hydrated) return
    setDirty(snapshot !== savedSnapshot.current)
  }, [snapshot, hydrated])

  // Warn on browser unload / tab close while there are unsaved changes.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty && !readOnly) {
        e.preventDefault()
        e.returnValue = ""
        return ""
      }
    }
    window.addEventListener("beforeunload", handler)
    return () => window.removeEventListener("beforeunload", handler)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, status])

  // Load existing campaign
  const { data: cData } = useQuery({
    queryKey: ["mkt-campaign", currentId],
    queryFn: () =>
      currentId
        ? sdk.client.fetch<{ campaign: any }>(`/admin/marketing/campaigns/${currentId}`, { method: "GET" })
        : Promise.resolve({ campaign: null } as any),
    enabled: !!currentId,
  })

  useEffect(() => {
    const c = (cData as any)?.campaign
    if (!c) return
    setName(c.name || "")
    setSubject(c.subject || "")
    setPreheader(c.preheader || "")
    setFromName(c.from_name || "")
    setFromEmail(c.from_email || "")
    setReplyTo(c.reply_to || "")
    setCustomHtml(c.custom_html || "")
    setListIds((Array.isArray(c.list_ids) && c.list_ids.length ? c.list_ids : [c.list_id]).filter(Boolean) as string[])
    setSegmentIds((Array.isArray(c.segment_ids) && c.segment_ids.length ? c.segment_ids : [c.segment_id]).filter(Boolean) as string[])
    setSuppressionSegmentIds(c.suppression_segment_ids || [])
    setScheduleAt(c.send_at ? toLocalInput(c.send_at) : "")
    setStatus(c.status || "draft")
    setSentAt(c.sent_at || null)
    setMetrics(c.metrics || {})

    // Email builder hydration: prefer saved blocks (→ visual mode); otherwise
    // fall back to raw HTML mode for backward compatibility with old campaigns.
    const savedBlocks = c.metadata?.blocks
    let nextBlocks: EmailBlock[] = []
    let nextMode: "blocks" | "html" = "html"
    if (Array.isArray(savedBlocks) && savedBlocks.length > 0) {
      nextBlocks = savedBlocks
      nextMode = "blocks"
    }
    setBlocks(nextBlocks)
    setEmailMode(nextMode)

    // A/B test hydration. variants[0] mirrors `subject`; 1..N are extra variants.
    const ab = c.ab_test
    const nextAbEnabled = !!ab?.enabled
    const nextAbVariants = Array.isArray(ab?.variants) ? ab.variants.slice(1) : []
    setAbEnabled(nextAbEnabled)
    setAbVariants(nextAbVariants)

    // Snapshot what we just loaded so dirty starts false.
    savedSnapshot.current = JSON.stringify({
      name: c.name || "",
      subject: c.subject || "",
      preheader: c.preheader || "",
      fromName: c.from_name || "",
      fromEmail: c.from_email || "",
      replyTo: c.reply_to || "",
      customHtml: c.custom_html || "",
      listIds: (Array.isArray(c.list_ids) && c.list_ids.length ? c.list_ids : [c.list_id]).filter(Boolean),
      segmentIds: (Array.isArray(c.segment_ids) && c.segment_ids.length ? c.segment_ids : [c.segment_id]).filter(Boolean),
      suppressionSegmentIds: c.suppression_segment_ids || [],
      scheduleAt: c.send_at ? toLocalInput(c.send_at) : "",
      blocks: nextBlocks,
      emailMode: nextMode,
      abEnabled: nextAbEnabled,
      abVariants: nextAbVariants,
    })
    setHydrated(true)
    setDirty(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cData])

  // Brand — for from-email defaults
  const brandsQ = useQuery({
    queryKey: ["mkt-brand-for-campaign", brandId],
    queryFn: () =>
      sdk.client.fetch<{ brands: any[] }>(`/admin/marketing/brands`, { method: "GET" }),
    enabled: !!brandId,
  })
  useEffect(() => {
    const b = (brandsQ.data as any)?.brands?.find((x: any) => x.id === brandId)
    if (b) {
      setBrand(b)
      // Prefill sender fields from the newly selected brand, but only on new
      // campaigns (don't trample an already-saved draft).
      if (!currentId) {
        setFromName(b.marketing_from_name || "")
        setFromEmail(b.marketing_from_email || "")
        setReplyTo(b.marketing_reply_to || "")
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandsQ.data, brandId])

  const brandAccent: string | undefined =
    brand?.brand_color || brand?.primary_color || brand?.accent_color || undefined

  const listsQ = useQuery({
    queryKey: ["mkt-lists", brandId],
    queryFn: () =>
      sdk.client.fetch<{ lists: any[] }>(`/admin/marketing/lists${bQs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const segmentsQ = useQuery({
    queryKey: ["mkt-segments", brandId],
    queryFn: () =>
      sdk.client.fetch<{ segments: any[] }>(`/admin/marketing/segments${bQs}`, { method: "GET" }),
    enabled: !!brandId,
  })

  const lists: any[] = ((listsQ.data as any)?.lists) || []
  const segments: any[] = ((segmentsQ.data as any)?.segments) || []

  // Keep custom_html in sync with blocks whenever the visual builder is active.
  useEffect(() => {
    if (emailMode !== "blocks") return
    setCustomHtml(compileBlocksToHtml(blocks, brandAccent))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, emailMode, brandAccent])

  const saveMut = useMutation({
    mutationFn: async (overrides?: { status?: string; send_at?: string | null }) => {
      // metadata.blocks is only meaningful in visual mode; in HTML mode we drop
      // it so a reload correctly opens raw HTML (custom_html stays the source).
      const metadata = emailMode === "blocks" ? { blocks } : { blocks: null }
      const body: any = {
        brand_id: brandId || undefined,
        name,
        subject: subject || null,
        preheader: preheader || null,
        from_name: fromName || null,
        from_email: fromEmail || null,
        reply_to: replyTo || null,
        custom_html: customHtml || null,
        // Persist full multi-select; keep singular for backward compat.
        list_ids: listIds,
        segment_ids: segmentIds,
        list_id: listIds[0] || null,
        segment_id: segmentIds[0] || null,
        suppression_segment_ids: suppressionSegmentIds,
        metadata,
        // A/B test subject line. Variant A = current `subject`; extra variants
        // append after it. Only enable when there's at least one real extra.
        ab_test:
          abEnabled && abVariants.filter(Boolean).length > 0
            ? { enabled: true, variants: [subject, ...abVariants.filter(Boolean)] }
            : { enabled: false, variants: [] },
        send_at: overrides?.send_at !== undefined ? overrides.send_at : (scheduleAt ? new Date(scheduleAt).toISOString() : null),
        status: overrides?.status || status,
      }
      if (currentId) {
        return sdk.client.fetch<{ campaign: any }>(`/admin/marketing/campaigns/${currentId}`, { method: "POST", body })
      }
      return sdk.client.fetch<{ campaign: any }>(`/admin/marketing/campaigns`, { method: "POST", body })
    },
    onSuccess: (resp: any) => {
      const c = resp?.campaign
      if (c?.id && !currentId) {
        setCurrentId(c.id)
        navigate(`/marketing/campaigns/${c.id}`, { replace: true })
      }
      if (c?.status) setStatus(c.status)
      // Mark current state as the saved baseline → dirty resets to false.
      savedSnapshot.current = snapshot
      setDirty(false)
      qc.invalidateQueries({ queryKey: ["mkt-campaigns"] })
      qc.invalidateQueries({ queryKey: ["mkt-campaign", c?.id] })
      toast.success("Campaign saved")
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.error ||
        e?.body?.error ||
        e?.error ||
        e?.message ||
        "unknown"
      toast.error("Failed: " + msg)
    },
  })

  const sendNowMut = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/marketing/campaigns/${currentId}/send-now`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-campaigns"] })
      qc.invalidateQueries({ queryKey: ["mkt-campaign", currentId] })
      toast.success("Campaign send started")
    },
    onError: (e: any) => {
      const msg =
        e?.response?.data?.error ||
        e?.body?.error ||
        e?.error ||
        e?.message ||
        "unknown"
      toast.error("Failed: " + msg)
    },
  })

  // Unschedule — revert a scheduled campaign back to draft so it can be edited.
  const unscheduleMut = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ campaign: any }>(`/admin/marketing/campaigns/${currentId}`, {
        method: "POST",
        body: { status: "draft" },
      }),
    onSuccess: (resp: any) => {
      setStatus(resp?.campaign?.status || "draft")
      qc.invalidateQueries({ queryKey: ["mkt-campaigns"] })
      qc.invalidateQueries({ queryKey: ["mkt-campaign", currentId] })
      toast.success("Campaign unscheduled — back to draft")
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const previewMut = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ count: number; sample: string[] }>(`/admin/marketing/preview-recipients`, {
        method: "POST",
        body: {
          brand_id: brandId,
          list_ids: listIds,
          segment_ids: segmentIds,
          suppression_segment_ids: suppressionSegmentIds,
        },
      }),
    onSuccess: (resp: any) => {
      setPreview({ count: resp?.count ?? 0, sample: resp?.sample ?? [] })
    },
    onError: () => toast.error("Failed to preview recipients"),
  })

  // Live recipient count — hits the ad-hoc preview endpoint as lists/segments
  // change. Debounced to avoid spamming the DB while the user ticks boxes.
  const [liveCount, setLiveCount] = useState<{ count: number; loading: boolean; error: boolean }>({
    count: 0, loading: false, error: false,
  })
  useEffect(() => {
    if (!brandId) return
    const hasAnyFilter = listIds.length > 0 || segmentIds.length > 0 || suppressionSegmentIds.length > 0
    if (!hasAnyFilter) {
      setLiveCount({ count: 0, loading: false, error: false })
      return
    }
    setLiveCount((s) => ({ ...s, loading: true, error: false }))
    const handle = setTimeout(async () => {
      try {
        const resp = await sdk.client.fetch<{ count: number; sample: string[] }>(
          `/admin/marketing/preview-recipients`,
          {
            method: "POST",
            body: {
              brand_id: brandId,
              list_ids: listIds,
              segment_ids: segmentIds,
              suppression_segment_ids: suppressionSegmentIds,
            },
          }
        )
        setLiveCount({ count: (resp as any)?.count ?? 0, loading: false, error: false })
      } catch {
        setLiveCount({ count: 0, loading: false, error: true })
      }
    }, 400)
    return () => clearTimeout(handle)
  }, [brandId, JSON.stringify(listIds), JSON.stringify(segmentIds), JSON.stringify(suppressionSegmentIds)])

  const readOnly = status === "sent" || status === "sending" || status === "sent_with_errors"
  const scheduled = status === "scheduled"
  // While scheduled, the form is locked until the user explicitly unschedules.
  const locked = scheduled
  const canSchedule = !!(name && subject && customHtml && fromEmail && scheduleAt)
  const canSendNow = !!(currentId && name && subject && customHtml && fromEmail)

  const [confirmSend, setConfirmSend] = useState(false)

  // What's still required before Schedule / Send now / Send test light up.
  const missing = [
    !name && "name",
    !subject && "subject",
    !customHtml && "email content",
    !fromEmail && "sender email",
  ].filter(Boolean) as string[]
  const missingForSchedule = [...missing, ...(!scheduleAt ? ["schedule time"] : [])]

  const toggleSel = (arr: string[], set: (v: string[]) => void, id: string) => {
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  const previewHtml = useMemo(() => buildPreviewDocument(customHtml, preheader), [customHtml, preheader])

  // ── Read-only (sent) view ────────────────────────────────────────────────
  if (readOnly) {
    return (
      <>
        <HeaderRow status={status} sentAt={sentAt} dirty={false} />
        <ReadOnlyView
          name={name}
          subject={subject}
          metrics={metrics}
          campaignId={currentId}
          html={customHtml}
          preheader={preheader}
        />
      </>
    )
  }

  return (
    <>
      <HeaderRow status={status} sentAt={sentAt} dirty={dirty} />

      {scheduled && (
        <div
          className="mkt-card"
          style={{
            padding: "14px 18px",
            marginBottom: "16px",
            background: tokens.infoSoft,
            border: `1px solid ${tokens.info}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontSize: "13px", color: tokens.info, lineHeight: 1.45 }}>
            <strong>This campaign is scheduled.</strong> To make changes, unschedule it first —
            it'll go back to draft.
            {scheduleAt && (
              <div style={{ marginTop: "2px", color: tokens.fgSecondary }}>
                Will send at {new Date(scheduleAt).toLocaleString()}
              </div>
            )}
          </div>
          <button
            className="mkt-btn"
            disabled={unscheduleMut.isPending}
            onClick={() => unscheduleMut.mutate()}
          >
            {unscheduleMut.isPending ? "Unscheduling…" : "Unschedule"}
          </button>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "flex-start" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Brand selector — prominent, drives all defaults below */}
          <div
            className="mkt-card"
            style={{
              padding: "18px 20px",
              border: `2px solid ${tokens.primary}`,
              background: tokens.primarySoft,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              <div style={{ flex: "0 0 auto" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: tokens.primary, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "2px" }}>
                  Brand
                </div>
                <div style={{ fontSize: "12px", color: tokens.fgSecondary }}>
                  Determines footer, from-email, recipients & tracking
                </div>
              </div>
              <div style={{ flex: 1, minWidth: "240px" }}>
                <select
                  className="mkt-input"
                  value={brandId || ""}
                  disabled={locked}
                  onChange={(e) => setBrandId(e.target.value || null)}
                  style={{
                    height: "44px",
                    fontSize: "15px",
                    fontWeight: 600,
                    borderColor: tokens.primary,
                    background: "#fff",
                  }}
                >
                  <option value="">— Select brand —</option>
                  {((brandsQ.data as any)?.brands || []).map((b: any) => (
                    <option key={b.id} value={b.id}>{b.display_name || b.slug}</option>
                  ))}
                </select>
              </div>
            </div>
            {brand && (
              <div style={{ marginTop: "10px", fontSize: "12px", color: tokens.fgSecondary, display: "flex", gap: "14px", flexWrap: "wrap" }}>
                <span>📧 {brand.marketing_from_email || "—"}</span>
                <span>🌐 {brand.storefront_domain || "—"}</span>
                <span>🌍 {(brand.locale || "en").toUpperCase()}</span>
                <span>{brand.compliance_footer_html ? "✅ Footer set" : "⚠️ No footer"}</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <Tabs
            tab={tab}
            onChange={setTab}
            recipientCount={liveCount}
            recipientHasFilter={listIds.length + segmentIds.length + suppressionSegmentIds.length > 0}
            scheduleAt={scheduleAt}
          />

          <fieldset disabled={locked} style={{ border: "none", padding: 0, margin: 0, minInlineSize: "auto" }}>
            {tab === "content" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Basics */}
                <div className="mkt-card" style={{ padding: "20px" }}>
                  <label className="mkt-label">Campaign name</label>
                  <input
                    className="mkt-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Spring promo 2026"
                  />

                  <label className="mkt-label" style={{ marginTop: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                    Subject
                    {abEnabled && <VariantTag index={0} />}
                  </label>
                  <input
                    className="mkt-input"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="The line that decides whether they open it"
                  />

                  <AbTestEditor
                    abEnabled={abEnabled}
                    setAbEnabled={setAbEnabled}
                    abVariants={abVariants}
                    setAbVariants={setAbVariants}
                  />

                  <label className="mkt-label" style={{ marginTop: "14px" }}>Preheader</label>
                  <input
                    className="mkt-input"
                    value={preheader}
                    onChange={(e) => setPreheader(e.target.value)}
                    placeholder="Preview text shown next to the subject in the inbox"
                  />

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "14px" }}>
                    <div>
                      <label className="mkt-label">Sender name</label>
                      <input
                        className="mkt-input"
                        value={fromName}
                        onChange={(e) => setFromName(e.target.value)}
                        placeholder={brand?.marketing_from_name || "Your name"}
                      />
                    </div>
                    <div>
                      <label className="mkt-label">Sender email</label>
                      <input
                        className="mkt-input"
                        type="email"
                        value={fromEmail}
                        onChange={(e) => setFromEmail(e.target.value)}
                        placeholder={brand?.marketing_from_email || "news@yourdomain.com"}
                      />
                    </div>
                  </div>
                  <label className="mkt-label" style={{ marginTop: "14px" }}>Reply-to <span style={{ color: tokens.fgMuted, fontWeight: 400 }}>(optional)</span></label>
                  <input
                    className="mkt-input"
                    type="email"
                    value={replyTo}
                    onChange={(e) => setReplyTo(e.target.value)}
                    placeholder={brand?.marketing_reply_to || "Leave empty to use sender email"}
                  />
                </div>

                {/* Email builder */}
                <EmailBuilderCard
                  blocks={blocks}
                  setBlocks={setBlocks}
                  emailMode={emailMode}
                  setEmailMode={setEmailMode}
                  emailView={emailView}
                  setEmailView={setEmailView}
                  customHtml={customHtml}
                  setCustomHtml={setCustomHtml}
                  previewHtml={previewHtml}
                  brandAccent={brandAccent}
                />
              </div>
            )}

            {tab === "recipients" && (
              <div className="mkt-card" style={{ padding: "20px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                  <div style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg, letterSpacing: "-0.005em" }}>
                    Recipients
                  </div>
                  <LiveCountBadge state={liveCount} hasFilter={listIds.length + segmentIds.length + suppressionSegmentIds.length > 0} />
                </div>
                <Checklist
                  label="Lists"
                  items={lists}
                  selected={listIds}
                  onChange={(id) => toggleSel(listIds, setListIds, id)}
                />
                <Checklist
                  label="Segments"
                  items={segments}
                  selected={segmentIds}
                  onChange={(id) => toggleSel(segmentIds, setSegmentIds, id)}
                  style={{ marginTop: "16px" }}
                />
                <Checklist
                  label="Suppression segments (exclude)"
                  items={segments}
                  selected={suppressionSegmentIds}
                  onChange={(id) => toggleSel(suppressionSegmentIds, setSuppressionSegmentIds, id)}
                  style={{ marginTop: "16px" }}
                />
                <div style={{ marginTop: "16px", display: "flex", gap: "10px", alignItems: "center" }}>
                  <button
                    className="mkt-btn mkt-btn-sm"
                    onClick={() => previewMut.mutate()}
                    disabled={
                      previewMut.isPending ||
                      !brandId ||
                      listIds.length + segmentIds.length + suppressionSegmentIds.length === 0
                    }
                  >
                    {previewMut.isPending ? "Counting…" : "Preview recipients"}
                  </button>
                  {(listIds.length + segmentIds.length + suppressionSegmentIds.length === 0) && (
                    <span style={{ fontSize: "12px", color: tokens.fgMuted }}>Select a list or segment first</span>
                  )}
                </div>
                {preview && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "12px 14px",
                      background: tokens.borderSubtle,
                      borderRadius: tokens.rMd,
                    }}
                  >
                    <div style={{ fontSize: "14px", fontWeight: 600, color: tokens.fg }}>{fmt(preview.count)} recipient(s)</div>
                    {preview.sample.length > 0 && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: tokens.fgSecondary,
                          marginTop: "6px",
                          maxHeight: "140px",
                          overflow: "auto",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        }}
                      >
                        {preview.sample.slice(0, 100).join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tab === "schedule" && (
              <div className="mkt-card" style={{ padding: "20px" }}>
                <div style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg, marginBottom: "14px", letterSpacing: "-0.005em" }}>
                  Schedule
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "10px", alignItems: "end" }}>
                  <div>
                    <label className="mkt-label">Send at</label>
                    <input
                      className="mkt-input"
                      type="datetime-local"
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                    />
                  </div>
                  <button className="mkt-btn" onClick={() => setScheduleAt("")}>
                    Clear
                  </button>
                </div>
                <ScheduleTimezoneHint scheduleAt={scheduleAt} />
                {!scheduleAt && (
                  <div style={{ marginTop: "12px", fontSize: "13px", color: tokens.fgSecondary, lineHeight: 1.5 }}>
                    Leave empty to send immediately with “Send now”, or pick a time and use
                    “Schedule” in the Actions panel.
                  </div>
                )}
              </div>
            )}
          </fieldset>
        </div>

        {/* RIGHT: actions sidebar — sticky, visible from every tab */}
        <div className="mkt-card" style={{ padding: "20px", position: "sticky", top: "16px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: tokens.fgSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              marginBottom: "12px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span>Actions</span>
            {dirty && (
              <span style={{ fontSize: "11px", fontWeight: 500, color: tokens.warningFg, textTransform: "none", letterSpacing: 0 }}>
                ● Unsaved
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <button
              className="mkt-btn"
              onClick={() => saveMut.mutate({ status: "draft" })}
              disabled={saveMut.isPending || !name || locked}
            >
              {saveMut.isPending ? "Saving…" : "Save draft"}
            </button>
            <TestSendButton
              brandId={brandId}
              subject={subject}
              preheader={preheader}
              fromName={fromName}
              fromEmail={fromEmail}
              replyTo={replyTo}
              html={customHtml}
              defaultTo={brand?.marketing_reply_to || ""}
            />
            <button
              className="mkt-btn-primary"
              disabled={!canSchedule || saveMut.isPending || locked}
              onClick={() => saveMut.mutate({ status: "scheduled" })}
            >
              Schedule
            </button>
            <button
              className="mkt-btn-primary"
              disabled={!canSendNow || sendNowMut.isPending || locked}
              onClick={() => setConfirmSend(true)}
            >
              {sendNowMut.isPending ? "Starting…" : "Send now"}
            </button>
          </div>
          {missingForSchedule.length > 0 && (
            <div style={{ marginTop: "10px", fontSize: "12px", color: tokens.fgMuted, lineHeight: 1.45 }}>
              Missing: {missingForSchedule.join(", ")}
            </div>
          )}
          {currentId && <CampaignAnalyticsPanel campaignId={currentId} />}
        </div>
      </div>

      {confirmSend && (
        <Modal
          title="Send campaign now?"
          onClose={() => setConfirmSend(false)}
          footer={
            <>
              <button className="mkt-btn" onClick={() => setConfirmSend(false)}>Cancel</button>
              <button
                className="mkt-btn-primary"
                disabled={sendNowMut.isPending}
                onClick={() => { setConfirmSend(false); sendNowMut.mutate() }}
              >
                {sendNowMut.isPending ? "Starting…" : "Send now"}
              </button>
            </>
          }
        >
          <div style={{ fontSize: "14px", color: tokens.fg, lineHeight: 1.6 }}>
            This will send <strong>{name || "this campaign"}</strong> to{" "}
            <strong>{liveCount.count > 0 ? `${fmt(liveCount.count)} recipient(s)` : "the selected recipients"}</strong> immediately.
            {dirty && (
              <div style={{ marginTop: "10px", color: tokens.warningFg }}>
                ⚠️ You have unsaved changes — save the draft first if you want them included.
              </div>
            )}
            <div style={{ marginTop: "10px", color: tokens.fgSecondary }}>This action cannot be undone.</div>
          </div>
        </Modal>
      )}
    </>
  )
}

// ═══════════════════════════════════════════
// HEADER ROW
// ═══════════════════════════════════════════
function HeaderRow({ status, sentAt, dirty }: { status: string; sentAt: string | null; dirty: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <StatusBadge status={status} />
        {sentAt && <span style={{ fontSize: "13px", color: tokens.fgSecondary }}>Sent {new Date(sentAt).toLocaleString()}</span>}
        {dirty && (
          <span style={{ fontSize: "12px", color: tokens.warningFg, fontWeight: 500 }}>● Unsaved changes</span>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// TABS
// ═══════════════════════════════════════════
function Tabs({
  tab,
  onChange,
  recipientCount,
  recipientHasFilter,
  scheduleAt,
}: {
  tab: "content" | "recipients" | "schedule"
  onChange: (t: "content" | "recipients" | "schedule") => void
  recipientCount: { count: number; loading: boolean; error: boolean }
  recipientHasFilter: boolean
  scheduleAt: string
}) {
  const items: { key: typeof tab; label: string; hint?: string }[] = [
    { key: "content", label: "Content" },
    {
      key: "recipients",
      label: "Recipients",
      hint: recipientHasFilter && !recipientCount.loading && !recipientCount.error ? fmt(recipientCount.count) : undefined,
    },
    { key: "schedule", label: "Schedule & send", hint: scheduleAt ? "⏱" : undefined },
  ]
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "4px",
        background: tokens.borderSubtle,
        borderRadius: tokens.rMd,
      }}
    >
      {items.map((it) => {
        const active = tab === it.key
        return (
          <button
            key={it.key}
            type="button"
            onClick={() => onChange(it.key)}
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: tokens.rSm,
              fontSize: "13px",
              fontWeight: active ? 600 : 500,
              color: active ? tokens.fg : tokens.fgSecondary,
              background: active ? tokens.surface : "transparent",
              boxShadow: active ? tokens.shadowSm : "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            {it.label}
            {it.hint && (
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: active ? tokens.primary : tokens.fgMuted,
                  background: active ? tokens.primarySoft : "transparent",
                  padding: active ? "1px 6px" : 0,
                  borderRadius: "999px",
                }}
              >
                {it.hint}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════
// EMAIL BUILDER CARD — Blocks / HTML / Preview
// ═══════════════════════════════════════════
function EmailBuilderCard({
  blocks,
  setBlocks,
  emailMode,
  setEmailMode,
  emailView,
  setEmailView,
  customHtml,
  setCustomHtml,
  previewHtml,
  brandAccent,
}: {
  blocks: EmailBlock[]
  setBlocks: (b: EmailBlock[]) => void
  emailMode: "blocks" | "html"
  setEmailMode: (m: "blocks" | "html") => void
  emailView: "edit" | "preview"
  setEmailView: (v: "edit" | "preview") => void
  customHtml: string
  setCustomHtml: (h: string) => void
  previewHtml: string
  brandAccent?: string
}) {
  const [showTemplates, setShowTemplates] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)

  // Switching INTO blocks mode when there are no blocks but there is raw HTML:
  // warn that the HTML will be replaced by the visual builder output.
  const switchToBlocks = () => {
    if (emailMode === "blocks") return
    if (blocks.length === 0 && customHtml.trim()) {
      const ok = window.confirm(
        "Switch to the visual builder? Your existing raw HTML will be replaced by the blocks you build."
      )
      if (!ok) return
    }
    setEmailMode("blocks")
  }
  const switchToHtml = () => setEmailMode("html")

  const applyTemplate = (tplId: string) => {
    const tpl = EMAIL_TEMPLATES.find((t) => t.id === tplId)
    if (!tpl) return
    if ((blocks.length > 0 || customHtml.trim()) &&
      !window.confirm("Replace the current email with this template?")) {
      return
    }
    setBlocks(tpl.build())
    setEmailMode("blocks")
    setShowTemplates(false)
  }

  return (
    <div className="mkt-card" style={{ padding: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", gap: "10px", flexWrap: "wrap" }}>
        <div style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg, letterSpacing: "-0.005em" }}>
          Email
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Mode toggle: Blocks | HTML */}
          <div style={{ display: "inline-flex", background: tokens.borderSubtle, borderRadius: tokens.rSm, padding: "3px" }}>
            <ModeBtn active={emailMode === "blocks"} onClick={switchToBlocks}>Blocks</ModeBtn>
            <ModeBtn active={emailMode === "html"} onClick={switchToHtml}>HTML</ModeBtn>
          </div>
          <div style={{ position: "relative" }}>
            <button className="mkt-btn mkt-btn-sm" onClick={() => setShowTemplates((v) => !v)}>
              Start from template ▾
            </button>
            {showTemplates && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 4px)",
                  right: 0,
                  zIndex: 40,
                  width: "280px",
                  background: tokens.surface,
                  border: `1px solid ${tokens.borderStrong}`,
                  borderRadius: tokens.rMd,
                  boxShadow: tokens.shadowMd,
                  padding: "6px",
                }}
              >
                {EMAIL_TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      width: "100%",
                      padding: "9px 10px",
                      background: "transparent",
                      border: "none",
                      borderRadius: tokens.rSm,
                      cursor: "pointer",
                      textAlign: "left",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = tokens.borderSubtle)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <span style={{ fontSize: "18px", lineHeight: 1.2 }}>{t.icon}</span>
                    <span>
                      <span style={{ display: "block", fontSize: "13px", fontWeight: 600, color: tokens.fg }}>{t.name}</span>
                      <span style={{ display: "block", fontSize: "12px", color: tokens.fgMuted, marginTop: "1px" }}>{t.description}</span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ fontSize: "12px", color: tokens.fgMuted, marginBottom: "14px" }}>
        Supports{" "}
        <code style={{ background: tokens.borderSubtle, padding: "1px 5px", borderRadius: "4px" }}>{"{{ first_name }}"}</code>,{" "}
        <code style={{ background: tokens.borderSubtle, padding: "1px 5px", borderRadius: "4px" }}>{"{{ first_name|default:\"vriend\" }}"}</code>,{" "}
        <code style={{ background: tokens.borderSubtle, padding: "1px 5px", borderRadius: "4px" }}>{"{{ unsubscribe_url }}"}</code>
      </div>

      {/* Editor body */}
      {emailMode === "blocks" ? (
        <BlockBuilder blocks={blocks} onChange={setBlocks} accentColor={brandAccent} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <label className="mkt-label">Custom HTML</label>
          <textarea
            value={customHtml}
            onChange={(e) => setCustomHtml(e.target.value)}
            placeholder={"<html>…</html>"}
            spellCheck={false}
            style={{
              minHeight: "360px",
              padding: "12px 14px",
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "13px",
              lineHeight: "1.5",
              border: `1px solid ${tokens.borderStrong}`,
              borderRadius: tokens.rMd,
              resize: "vertical",
              color: tokens.fg,
              background: tokens.surface,
            }}
          />
        </div>
      )}

      {/* Collapsible preview */}
      <div style={{ marginTop: "18px", borderTop: `1px solid ${tokens.borderSubtle}`, paddingTop: "14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <label className="mkt-label" style={{ margin: 0 }}>Preview</label>
          <button className="mkt-btn mkt-btn-sm" onClick={() => setPreviewOpen((v) => !v)}>
            {previewOpen ? "Hide preview" : "Show preview"}
          </button>
        </div>
        {previewOpen && (
          <div
            style={{
              marginTop: "10px",
              border: `1px solid ${tokens.borderStrong}`,
              borderRadius: tokens.rMd,
              background: "#F3F2EE",
              overflow: "auto",
              maxHeight: "600px",
              padding: "16px 0",
            }}
          >
            {customHtml ? (
              <iframe
                title="email-preview"
                srcDoc={previewHtml}
                sandbox=""
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: "640px",
                  height: "560px",
                  margin: "0 auto",
                  border: "0",
                  background: "#fff",
                  borderRadius: "6px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              />
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "200px",
                  color: tokens.fgMuted,
                  fontSize: "14px",
                }}
              >
                Nothing to preview yet — add blocks or HTML above.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ModeBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 12px",
        fontSize: "12px",
        fontWeight: active ? 600 : 500,
        color: active ? tokens.fg : tokens.fgSecondary,
        background: active ? tokens.surface : "transparent",
        boxShadow: active ? tokens.shadowSm : "none",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  )
}

// ═══════════════════════════════════════════
// A/B TEST SUBJECT LINE
// ═══════════════════════════════════════════
const AB_LABELS = ["A", "B", "C", "D"]

function VariantTag({ index }: { index: number }) {
  return (
    <span
      style={{
        fontSize: "10px",
        fontWeight: 700,
        color: tokens.primary,
        background: tokens.primarySoft,
        padding: "1px 7px",
        borderRadius: "999px",
        letterSpacing: "0.04em",
        textTransform: "none",
      }}
    >
      Variant {AB_LABELS[index] || index + 1}
    </span>
  )
}

function AbTestEditor({
  abEnabled,
  setAbEnabled,
  abVariants,
  setAbVariants,
}: {
  abEnabled: boolean
  setAbEnabled: (v: boolean) => void
  abVariants: string[]
  setAbVariants: (v: string[]) => void
}) {
  // Variant A = main subject, so extra variants top out at 3 (4 total).
  const MAX_EXTRA = 3
  const updateVariant = (i: number, value: string) =>
    setAbVariants(abVariants.map((v, idx) => (idx === i ? value : v)))
  const removeVariant = (i: number) =>
    setAbVariants(abVariants.filter((_, idx) => idx !== i))
  const addVariant = () => {
    if (abVariants.length >= MAX_EXTRA) return
    setAbVariants([...abVariants, ""])
  }

  return (
    <div style={{ marginTop: "12px" }}>
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "13px",
          color: tokens.fg,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={abEnabled}
          onChange={(e) => setAbEnabled(e.target.checked)}
        />
        <span style={{ fontWeight: 600 }}>A/B test subject line</span>
      </label>

      {abEnabled && (
        <div
          style={{
            marginTop: "10px",
            padding: "14px",
            border: `1px solid ${tokens.borderStrong}`,
            borderRadius: tokens.rMd,
            background: tokens.bg,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {abVariants.map((v, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {/* +1 → variant A is the main subject, so extras start at B */}
                  <VariantTag index={i + 1} />
                  <button
                    type="button"
                    className="mkt-btn mkt-btn-sm"
                    onClick={() => removeVariant(i)}
                    title="Remove this variant"
                  >
                    Remove
                  </button>
                </div>
                <input
                  className="mkt-input"
                  value={v}
                  onChange={(e) => updateVariant(i, e.target.value)}
                  placeholder={`Subject line for variant ${AB_LABELS[i + 1] || i + 2}`}
                />
              </div>
            ))}
          </div>

          <div style={{ marginTop: abVariants.length ? "12px" : 0, display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="mkt-btn mkt-btn-sm"
              onClick={addVariant}
              disabled={abVariants.length >= MAX_EXTRA}
            >
              + Add variant
            </button>
            {abVariants.length >= MAX_EXTRA && (
              <span style={{ fontSize: "12px", color: tokens.fgMuted }}>Maximum 4 variants</span>
            )}
          </div>

          <div style={{ marginTop: "10px", fontSize: "12px", color: tokens.fgMuted, lineHeight: 1.45 }}>
            Recipients are split evenly across variants; compare open/click rates after sending.
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════
// A/B RESULTS (read-only, sent campaign)
// ═══════════════════════════════════════════
type AbVariantResult = {
  index: number
  subject: string
  sent: number
  opened: number
  clicked: number
  open_rate: number
  click_rate: number
}

function AbResultsTable({ variants }: { variants: AbVariantResult[] }) {
  if (!Array.isArray(variants) || variants.length < 2) return null
  // Winner = highest open_rate (primary metric).
  const winnerIdx = variants.reduce(
    (best, v, i) => (v.open_rate > variants[best].open_rate ? i : best),
    0
  )
  return (
    <div style={{ marginTop: "20px", borderTop: `1px solid ${tokens.borderSubtle}`, paddingTop: "16px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: tokens.fgSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: "10px",
        }}
      >
        A/B results
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "60px 1fr 70px 90px 90px",
            gap: "10px",
            fontSize: "11px",
            fontWeight: 600,
            color: tokens.fgMuted,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            padding: "0 10px",
          }}
        >
          <span>Variant</span>
          <span>Subject</span>
          <span style={{ textAlign: "right" }}>Sent</span>
          <span style={{ textAlign: "right" }}>Open rate</span>
          <span style={{ textAlign: "right" }}>Click rate</span>
        </div>
        {variants.map((v, i) => {
          const isWinner = i === winnerIdx
          return (
            <div
              key={v.index ?? i}
              style={{
                display: "grid",
                gridTemplateColumns: "60px 1fr 70px 90px 90px",
                gap: "10px",
                alignItems: "center",
                padding: "8px 10px",
                borderRadius: tokens.rSm,
                background: isWinner ? tokens.successSoft : tokens.bg,
                border: isWinner ? `1px solid ${tokens.successFg}` : "1px solid transparent",
                fontSize: "13px",
                color: tokens.fg,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 600 }}>
                {AB_LABELS[v.index] || AB_LABELS[i] || i + 1}
                {isWinner && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 700,
                      color: "#fff",
                      background: tokens.successFg,
                      padding: "1px 6px",
                      borderRadius: "999px",
                      letterSpacing: "0.03em",
                    }}
                  >
                    Winner
                  </span>
                )}
              </span>
              <span
                style={{
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: tokens.fgSecondary,
                }}
                title={v.subject}
              >
                {v.subject || "—"}
              </span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{fmt(v.sent || 0)}</span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums", fontWeight: isWinner ? 700 : 500, color: isWinner ? tokens.successFg : tokens.fg }}>
                {((v.open_rate || 0) * 100).toFixed(1)}%
              </span>
              <span style={{ textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                {((v.click_rate || 0) * 100).toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════
// SCHEDULE TIMEZONE HINT
// ═══════════════════════════════════════════
function ScheduleTimezoneHint({ scheduleAt }: { scheduleAt: string }) {
  if (!scheduleAt) return null
  const local = new Date(scheduleAt)
  if (isNaN(local.getTime())) return null
  const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone || "local time"
  const offsetMin = -local.getTimezoneOffset()
  const sign = offsetMin >= 0 ? "+" : "-"
  const abs = Math.abs(offsetMin)
  const offsetLabel = `UTC${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`
  return (
    <div
      style={{
        marginTop: "12px",
        padding: "10px 14px",
        background: tokens.infoSoft,
        borderRadius: tokens.rMd,
        fontSize: "13px",
        color: tokens.info,
        lineHeight: 1.5,
      }}
    >
      Will send at{" "}
      <strong>
        {local.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
      </strong>{" "}
      ({tzName}, {offsetLabel})
      <div style={{ color: tokens.fgSecondary, marginTop: "2px", fontVariantNumeric: "tabular-nums" }}>
        = {local.toISOString().slice(0, 16).replace("T", " ")} UTC
      </div>
    </div>
  )
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function TestSendButton({
  brandId, subject, preheader, fromName, fromEmail, replyTo, html, defaultTo,
}: {
  brandId: string | null
  subject: string
  preheader: string
  fromName: string
  fromEmail: string
  replyTo: string
  html: string
  defaultTo?: string
}) {
  const [testTo, setTestTo] = useState(defaultTo || "")
  const emailValid = EMAIL_RE.test(testTo.trim())
  const canSend = !!brandId && !!subject && !!html && emailValid
  const testSendMut = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/marketing/email/test-send`, {
        method: "POST",
        body: {
          brand_id: brandId,
          to_email: testTo.trim(),
          subject,
          preheader,
          from_name: fromName,
          from_email: fromEmail,
          reply_to: replyTo,
          html,
        },
      }),
    onSuccess: () => toast.success(`Test email sent to ${testTo.trim()}`),
    onError: (e: any) => toast.error("Test send failed: " + (e?.message || "unknown")),
  })
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <input
        className="mkt-input"
        type="email"
        value={testTo}
        onChange={(e) => setTestTo(e.target.value)}
        placeholder="Test recipient email"
        style={{ height: "36px", fontSize: "13px" }}
      />
      <button
        className="mkt-btn"
        onClick={() => testSendMut.mutate()}
        disabled={!canSend || testSendMut.isPending}
        title={
          canSend
            ? `Send test to ${testTo.trim()}`
            : !emailValid
            ? "Enter a valid test recipient email"
            : "Fill in brand, subject, and email content first"
        }
      >
        {testSendMut.isPending ? "Sending test…" : "📧 Send test"}
      </button>
    </div>
  )
}

function CampaignAnalyticsPanel({ campaignId }: { campaignId: string }) {
  const { data } = useQuery({
    queryKey: ["mkt-campaign-analytics", campaignId],
    queryFn: () =>
      sdk.client.fetch<{
        funnel: any
        revenue: any
        links: Array<{ link_label: string; clicks: number; unique_clickers: number }>
      }>(`/admin/marketing/campaigns/${campaignId}/analytics`, { method: "GET" }),
    refetchInterval: 30000,
  })
  if (!(data as any)?.funnel) return null
  const f = (data as any).funnel
  const r = (data as any).revenue || {}
  const links = ((data as any).links || []) as Array<{ link_label: string; clicks: number; unique_clickers: number }>
  return (
    <div style={{ marginTop: "20px", fontSize: "13px", color: tokens.fg }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: tokens.fgSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: "8px",
        }}
      >
        Performance
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
        <div>Sent: <strong>{fmt(f.sent || 0)}</strong></div>
        <div>Delivered: <strong>{fmt(f.delivered || 0)}</strong></div>
        <div>Opened (unique): <strong>{fmt(f.opened_unique || 0)}</strong> <span style={{ color: tokens.fgMuted }}>({((f.open_rate || 0) * 100).toFixed(1)}%)</span></div>
        <div>Clicked (unique): <strong>{fmt(f.clicked_unique || 0)}</strong> <span style={{ color: tokens.fgMuted }}>({((f.ctr || 0) * 100).toFixed(1)}%)</span></div>
        <div>CTOR: <strong>{((f.ctor || 0) * 100).toFixed(1)}%</strong></div>
        <div>Bounced: <strong>{fmt(f.bounced || 0)}</strong></div>
      </div>
      <div
        style={{
          marginTop: "14px",
          padding: "10px 14px",
          background: tokens.successSoft,
          borderRadius: tokens.rMd,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "8px",
        }}
      >
        <div>Orders: <strong style={{ color: tokens.successFg }}>{fmt(r.orders || 0)}</strong></div>
        <div>Revenue: <strong style={{ color: tokens.successFg }}>€ {Number(r.revenue_eur || 0).toFixed(2)}</strong></div>
        <div>Conversion: <strong>{((r.conversion_rate || 0) * 100).toFixed(2)}%</strong></div>
        <div>RPE: <strong>€ {Number(r.rpe || 0).toFixed(3)}</strong></div>
      </div>
      {links.length > 0 && (
        <div style={{ marginTop: "14px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "6px" }}>
            Link performance
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
            {links.map((l) => (
              <div key={l.link_label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 10px", background: tokens.bg, borderRadius: tokens.rSm }}>
                <span style={{ fontFamily: "ui-monospace, monospace", color: tokens.fgSecondary }}>{l.link_label}</span>
                <span>
                  <strong>{fmt(l.clicks)}</strong> clicks <span style={{ color: tokens.fgMuted }}>/ {fmt(l.unique_clickers)} unique</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Build the srcdoc for the preview iframe. Adds a hidden preheader node and
 * strips <script> tags defensively (the sandbox attr also blocks scripts).
 */
function buildPreviewDocument(html: string, preheader: string): string {
  const safe = (html || "").replace(/<script[\s\S]*?<\/script>/gi, "")
  const preheaderNode = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;visibility:hidden;mso-hide:all">${escapeHtml(preheader)}</div>`
    : ""
  if (/<body[\s>]/i.test(safe)) {
    return safe.replace(/<body([^>]*)>/i, (m) => `${m}${preheaderNode}`)
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${preheaderNode}${safe}</body></html>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

/** Convert an ISO/date string to a `datetime-local`-compatible value in the
 *  browser's local timezone. */
function toLocalInput(value: string | number | Date): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function LiveCountBadge({
  state,
  hasFilter,
}: {
  state: { count: number; loading: boolean; error: boolean }
  hasFilter: boolean
}) {
  if (!hasFilter) {
    return (
      <span style={{ fontSize: "12px", color: tokens.fgMuted }}>
        Select a list or segment
      </span>
    )
  }
  if (state.loading) {
    return (
      <span style={{ fontSize: "12px", color: tokens.fgMuted }}>
        Counting…
      </span>
    )
  }
  if (state.error) {
    return (
      <span style={{ fontSize: "12px", color: tokens.dangerFg }}>
        Count failed
      </span>
    )
  }
  return (
    <span
      style={{
        fontSize: "13px",
        fontWeight: 600,
        color: state.count > 0 ? tokens.successFg : tokens.fgMuted,
        background: state.count > 0 ? tokens.successSoft : tokens.borderSubtle,
        padding: "4px 10px",
        borderRadius: "999px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {fmt(state.count)} recipient{state.count === 1 ? "" : "s"}
    </span>
  )
}

function Checklist({
  label,
  items,
  selected,
  onChange,
  style,
}: {
  label: string
  items: any[]
  selected: string[]
  onChange: (id: string) => void
  style?: React.CSSProperties
}) {
  return (
    <div style={style}>
      <label className="mkt-label">{label}</label>
      {items.length === 0 ? (
        <div style={{ fontSize: "13px", color: tokens.fgMuted }}>None available</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
          {items.map((it: any) => {
            const on = selected.includes(it.id)
            const count = it.member_count ?? it.count
            const hasCount = count !== undefined && count !== null
            return (
              <label
                key={it.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 12px",
                  borderRadius: tokens.rMd,
                  border: on ? `1.5px solid ${tokens.primary}` : `1px solid ${tokens.borderStrong}`,
                  background: on ? tokens.primarySoft : tokens.surface,
                  fontSize: "13px",
                  color: tokens.fg,
                  cursor: "pointer",
                  transition: "background 120ms ease-out, border-color 120ms ease-out",
                }}
              >
                <input type="checkbox" checked={on} onChange={() => onChange(it.id)} />
                <span>
                  {it.name}
                  {hasCount && (
                    <span style={{ color: tokens.fgMuted, fontVariantNumeric: "tabular-nums" }}> ({fmt(Number(count))})</span>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReadOnlyView({
  name,
  subject,
  metrics,
  campaignId,
  html,
  preheader,
}: {
  name: string
  subject: string
  metrics: any
  campaignId?: string
  html?: string
  preheader?: string
}) {
  const [showEmail, setShowEmail] = useState(false)
  // Live analytics — pulled from the /analytics endpoint (computed live from
  // marketing_message). This is the source of truth for open/click/bounce.
  const { data: analytics } = useQuery({
    queryKey: ["mkt-campaign-analytics", campaignId],
    queryFn: () =>
      sdk.client.fetch<{
        funnel: any
        revenue: any
        links: Array<{ link_label: string; clicks: number; unique_clickers: number }>
        ab_variants?: AbVariantResult[]
      }>(`/admin/marketing/campaigns/${campaignId}/analytics`, { method: "GET" }),
    enabled: !!campaignId,
    refetchInterval: 30000,
  })

  const abVariants = (analytics as any)?.ab_variants as AbVariantResult[] | undefined
  const funnel = (analytics as any)?.funnel
  const vals = {
    sent: funnel ? (funnel.sent || 0) : Number(metrics?.sent) || 0,
    delivered: funnel ? (funnel.delivered || 0) : Number(metrics?.delivered) || 0,
    opened: funnel ? (funnel.opened_unique || 0) : Number(metrics?.opened) || 0,
    clicked: funnel ? (funnel.clicked_unique || 0) : Number(metrics?.clicked) || 0,
    bounced: funnel ? (funnel.bounced || 0) : Number(metrics?.bounced) || 0,
  }

  const bars: { label: string; key: keyof typeof vals; color: string }[] = [
    { label: "Sent", key: "sent", color: tokens.fgSecondary },
    { label: "Delivered", key: "delivered", color: tokens.primary },
    { label: "Opened", key: "opened", color: tokens.info },
    { label: "Clicked", key: "clicked", color: tokens.purple },
    { label: "Bounced", key: "bounced", color: tokens.dangerFg },
  ]
  const max = Math.max(1, ...bars.map((b) => Number(vals[b.key]) || 0))
  const sentTotal = Number(vals.sent) || 0
  const previewHtml = buildPreviewDocument(html || "", preheader || "")

  return (
    <div className="mkt-card" style={{ padding: "24px" }}>
      <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px", color: tokens.fg, letterSpacing: "-0.005em" }}>{name}</div>
      {subject && <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginBottom: "20px" }}>Subject: {subject}</div>}

      {/* Rate summary cards — only meaningful once we have live funnel data */}
      {funnel && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px", marginBottom: "20px" }}>
          <RateCard label="Open rate" value={`${((funnel.open_rate || 0) * 100).toFixed(1)}%`} sub={`${fmt(funnel.opened_unique || 0)} unique`} color={tokens.info} />
          <RateCard label="Click rate" value={`${((funnel.ctr || 0) * 100).toFixed(1)}%`} sub={`${fmt(funnel.clicked_unique || 0)} unique`} color={tokens.purple} />
          <RateCard label="CTOR" value={`${((funnel.ctor || 0) * 100).toFixed(1)}%`} sub="of openers" color={tokens.primary} />
          <RateCard
            label="Bounce rate"
            value={`${(funnel.sent ? ((funnel.bounced || 0) / funnel.sent) * 100 : 0).toFixed(1)}%`}
            sub={`${fmt(funnel.bounced || 0)} bounced`}
            color={tokens.dangerFg}
          />
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {bars.map((b) => {
          const v = Number(vals[b.key]) || 0
          const pc = (v / max) * 100
          // % of sent — skip on the Sent bar itself (always 100%).
          const ofSent = b.key !== "sent" && sentTotal > 0 ? (v / sentTotal) * 100 : null
          return (
            <div key={b.key} style={{ display: "grid", gridTemplateColumns: "100px 1fr 120px", alignItems: "center", gap: "12px" }}>
              <div style={{ fontSize: "13px", color: tokens.fgSecondary, fontWeight: 500 }}>{b.label}</div>
              <div style={{ background: tokens.borderSubtle, borderRadius: "6px", overflow: "hidden", height: "12px" }}>
                <div style={{ width: `${pc}%`, height: "100%", background: b.color, transition: "width 300ms ease-out", borderRadius: "6px" }} />
              </div>
              <div style={{ fontSize: "13px", textAlign: "right", color: tokens.fg, fontVariantNumeric: "tabular-nums" }}>
                {v.toLocaleString()}
                {ofSent !== null && (
                  <span style={{ color: tokens.fgMuted, marginLeft: "6px" }}>({ofSent.toFixed(1)}%)</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* A/B results — only when the analytics endpoint returns variant data */}
      {abVariants && abVariants.length >= 2 && <AbResultsTable variants={abVariants} />}

      {/* Collapsible: view the sent email */}
      {html && (
        <div style={{ marginTop: "20px", borderTop: `1px solid ${tokens.borderSubtle}`, paddingTop: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: tokens.fg }}>Sent email</div>
            <button className="mkt-btn mkt-btn-sm" onClick={() => setShowEmail((v) => !v)}>
              {showEmail ? "Hide email" : "View sent email"}
            </button>
          </div>
          {showEmail && (
            <div
              style={{
                marginTop: "10px",
                border: `1px solid ${tokens.borderStrong}`,
                borderRadius: tokens.rMd,
                background: "#F3F2EE",
                overflow: "auto",
                maxHeight: "600px",
                padding: "16px 0",
              }}
            >
              <iframe
                title="sent-email-preview"
                srcDoc={previewHtml}
                sandbox=""
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: "640px",
                  height: "560px",
                  margin: "0 auto",
                  border: "0",
                  background: "#fff",
                  borderRadius: "6px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Full analytics panel — revenue + link breakdown (live) */}
      {campaignId && <CampaignAnalyticsPanel campaignId={campaignId} />}
    </div>
  )
}

function RateCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div
      style={{
        padding: "12px 14px",
        border: `1px solid ${tokens.borderStrong}`,
        borderRadius: tokens.rMd,
        background: tokens.surface,
      }}
    >
      <div style={{ fontSize: "11px", fontWeight: 600, color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: "22px", fontWeight: 700, color, marginTop: "2px", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: tokens.fgMuted, marginTop: "2px" }}>{sub}</div>}
    </div>
  )
}
