import React, { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { sdk } from "../../lib/sdk"
import { useSelectedBrand, StatusBadge, brandQs, fmt, tokens } from "./shared"

/**
 * Campaign editor — single-page layout.
 *
 * Fields in order (user-facing):
 *   1. Campaign name
 *   2. Subject
 *   3. Preheader
 *   4. Sender name + sender email
 *   5. Recipients (lists, segments, suppression segments)
 *   6. Email HTML + live preview (side-by-side)
 *
 * Templates are NOT part of this flow. Each campaign carries its own HTML.
 */
export function CampaignEditor({ campaignId }: { campaignId?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { brandId } = useSelectedBrand()
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
    setListIds([c.list_id].filter(Boolean) as string[])
    setSegmentIds([c.segment_id].filter(Boolean) as string[])
    setSuppressionSegmentIds(c.suppression_segment_ids || [])
    setScheduleAt(c.send_at ? new Date(c.send_at).toISOString().slice(0, 16) : "")
    setStatus(c.status || "draft")
    setSentAt(c.sent_at || null)
    setMetrics(c.metrics || {})
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
      if (!fromName && !currentId) setFromName(b.marketing_from_name || "")
      if (!fromEmail && !currentId) setFromEmail(b.marketing_from_email || "")
      if (!replyTo && !currentId) setReplyTo(b.marketing_reply_to || "")
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandsQ.data, brandId])

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

  const saveMut = useMutation({
    mutationFn: async (overrides?: { status?: string; send_at?: string | null }) => {
      const body: any = {
        brand_id: brandId || undefined,
        name,
        subject: subject || null,
        preheader: preheader || null,
        from_name: fromName || null,
        from_email: fromEmail || null,
        reply_to: replyTo || null,
        custom_html: customHtml || null,
        list_id: listIds[0] || null,
        segment_id: segmentIds[0] || null,
        suppression_segment_ids: suppressionSegmentIds,
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

  const previewMut = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ count: number; sample: string[] }>(`/admin/marketing/campaigns/${currentId}/recipients`, { method: "GET" }),
    onSuccess: (resp: any) => {
      setPreview({ count: resp?.count ?? 0, sample: resp?.sample ?? [] })
    },
    onError: () => toast.error("Failed to preview recipients"),
  })

  // Live recipient count — hits the ad-hoc preview endpoint as lists/segments
  // change. Debounced to avoid spamming the DB while the user ticks boxes.
  // Works before the campaign is saved (no currentId required).
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
              list_id: listIds[0] || null,
              segment_id: segmentIds[0] || null,
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

  const readOnly = status === "sent" || status === "sending"
  const canSchedule = !!(name && subject && customHtml && fromEmail && scheduleAt)
  const canSendNow = !!(currentId && name && subject && customHtml && fromEmail)

  const toggleSel = (arr: string[], set: (v: string[]) => void, id: string) => {
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  const previewHtml = useMemo(() => buildPreviewDocument(customHtml, preheader), [customHtml, preheader])

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <StatusBadge status={status} />
          {sentAt && <span style={{ fontSize: "13px", color: tokens.fgSecondary }}>Sent {new Date(sentAt).toLocaleString()}</span>}
        </div>
      </div>

      {readOnly ? (
        <ReadOnlyView name={name} subject={subject} metrics={metrics} />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "flex-start" }}>
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

              <label className="mkt-label" style={{ marginTop: "14px" }}>Subject</label>
              <input
                className="mkt-input"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="The line that decides whether they open it"
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

            {/* Recipients */}
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
                  disabled={!currentId || previewMut.isPending}
                >
                  {previewMut.isPending ? "Counting…" : "Preview recipients"}
                </button>
                {!currentId && <span style={{ fontSize: "12px", color: tokens.fgMuted }}>Save draft first</span>}
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

            {/* Email — HTML editor + live preview */}
            <div className="mkt-card" style={{ padding: "20px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <div style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg, letterSpacing: "-0.005em" }}>
                  Email
                </div>
                <span style={{ fontSize: "12px", color: tokens.fgMuted }}>
                  Supports <code style={{ background: tokens.borderSubtle, padding: "1px 5px", borderRadius: "4px" }}>{"{{ first_name }}"}</code>, <code style={{ background: tokens.borderSubtle, padding: "1px 5px", borderRadius: "4px" }}>{"{{ first_name|default:\"vriend\" }}"}</code>, <code style={{ background: tokens.borderSubtle, padding: "1px 5px", borderRadius: "4px" }}>{"{{ unsubscribe_url }}"}</code>
                </span>
              </div>
              {/* Stacked layout: HTML editor on top, full-width preview below */}
              <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <label className="mkt-label">Custom HTML</label>
                  <textarea
                    value={customHtml}
                    onChange={(e) => setCustomHtml(e.target.value)}
                    placeholder={"<html>…</html>"}
                    spellCheck={false}
                    style={{
                      minHeight: "420px",
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
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <label className="mkt-label" style={{ margin: 0 }}>Preview</label>
                    <span style={{ fontSize: "11px", color: tokens.fgMuted }}>
                      Rendered at ~640px, like an inbox client
                    </span>
                  </div>
                  <div
                    style={{
                      minHeight: "800px",
                      border: `1px solid ${tokens.borderStrong}`,
                      borderRadius: tokens.rMd,
                      background: "#F3F2EE",
                      overflow: "hidden",
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
                          maxWidth: "680px",
                          height: "900px",
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
                          height: "800px",
                          color: tokens.fgMuted,
                          fontSize: "14px",
                        }}
                      >
                        Empty HTML — start typing above to see preview
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Schedule */}
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
            </div>
          </div>

          {/* RIGHT: actions sidebar */}
          <div className="mkt-card" style={{ padding: "20px", position: "sticky", top: "16px" }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: tokens.fgSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
                marginBottom: "12px",
              }}
            >
              Actions
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                className="mkt-btn"
                onClick={() => saveMut.mutate({ status: "draft" })}
                disabled={saveMut.isPending || !name}
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
              />
              <button
                className="mkt-btn-primary"
                disabled={!canSchedule || saveMut.isPending}
                onClick={() => saveMut.mutate({ status: "scheduled" })}
              >
                Schedule
              </button>
              <button
                className="mkt-btn-primary"
                disabled={!canSendNow || sendNowMut.isPending}
                onClick={() => { if (confirm("Send this campaign now?")) sendNowMut.mutate() }}
                style={{ background: tokens.danger }}
              >
                {sendNowMut.isPending ? "Starting…" : "Send now"}
              </button>
            </div>
            {currentId && <CampaignAnalyticsPanel campaignId={currentId} />}
          </div>
        </div>
      )}
    </>
  )
}

const TEST_EMAIL_TO = "jaroslavostruszka@gmail.com"

function TestSendButton({
  brandId, subject, preheader, fromName, fromEmail, replyTo, html,
}: {
  brandId: string | null
  subject: string
  preheader: string
  fromName: string
  fromEmail: string
  replyTo: string
  html: string
}) {
  const canSend = !!brandId && !!subject && !!html
  const testSendMut = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/marketing/email/test-send`, {
        method: "POST",
        body: {
          brand_id: brandId,
          to_email: TEST_EMAIL_TO,
          subject,
          preheader,
          from_name: fromName,
          from_email: fromEmail,
          reply_to: replyTo,
          html,
        },
      }),
    onSuccess: () => toast.success(`Test email sent to ${TEST_EMAIL_TO}`),
    onError: (e: any) => toast.error("Test send failed: " + (e?.message || "unknown")),
  })
  return (
    <button
      className="mkt-btn"
      onClick={() => testSendMut.mutate()}
      disabled={!canSend || testSendMut.isPending}
      title={canSend ? `Send test to ${TEST_EMAIL_TO}` : "Fill in brand, subject, and HTML first"}
    >
      {testSendMut.isPending ? "Sending test…" : "📧 Send test"}
    </button>
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
  if (!data) return null
  const f = (data as any).funnel
  const r = (data as any).revenue
  const links = (data as any).links as Array<{ link_label: string; clicks: number; unique_clickers: number }>
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
        <div>Sent: <strong>{fmt(f.sent)}</strong></div>
        <div>Delivered: <strong>{fmt(f.delivered)}</strong></div>
        <div>Opened (unique): <strong>{fmt(f.opened_unique)}</strong> <span style={{ color: tokens.fgMuted }}>({(f.open_rate * 100).toFixed(1)}%)</span></div>
        <div>Clicked (unique): <strong>{fmt(f.clicked_unique)}</strong> <span style={{ color: tokens.fgMuted }}>({(f.ctr * 100).toFixed(1)}%)</span></div>
        <div>CTOR: <strong>{(f.ctor * 100).toFixed(1)}%</strong></div>
        <div>Bounced: <strong>{fmt(f.bounced)}</strong></div>
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
        <div>Orders: <strong style={{ color: tokens.successFg }}>{fmt(r.orders)}</strong></div>
        <div>Revenue: <strong style={{ color: tokens.successFg }}>€ {Number(r.revenue_eur).toFixed(2)}</strong></div>
        <div>Conversion: <strong>{(r.conversion_rate * 100).toFixed(2)}%</strong></div>
        <div>RPE: <strong>€ {Number(r.rpe).toFixed(3)}</strong></div>
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
                <span>{it.name}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ReadOnlyView({ name, subject, metrics }: { name: string; subject: string; metrics: any }) {
  const bars: { label: string; key: string; color: string }[] = [
    { label: "Sent", key: "sent", color: tokens.fgSecondary },
    { label: "Delivered", key: "delivered", color: tokens.primary },
    { label: "Opened", key: "opened", color: tokens.info },
    { label: "Clicked", key: "clicked", color: tokens.purple },
    { label: "Bounced", key: "bounced", color: tokens.dangerFg },
  ]
  const max = Math.max(1, ...bars.map((b) => Number(metrics?.[b.key]) || 0))
  return (
    <div className="mkt-card" style={{ padding: "24px" }}>
      <div style={{ fontSize: "18px", fontWeight: 600, marginBottom: "4px", color: tokens.fg, letterSpacing: "-0.005em" }}>{name}</div>
      {subject && <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginBottom: "20px" }}>Subject: {subject}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {bars.map((b) => {
          const v = Number(metrics?.[b.key]) || 0
          const pc = (v / max) * 100
          return (
            <div key={b.key} style={{ display: "grid", gridTemplateColumns: "100px 1fr 80px", alignItems: "center", gap: "12px" }}>
              <div style={{ fontSize: "13px", color: tokens.fgSecondary, fontWeight: 500 }}>{b.label}</div>
              <div style={{ background: tokens.borderSubtle, borderRadius: "6px", overflow: "hidden", height: "12px" }}>
                <div style={{ width: `${pc}%`, height: "100%", background: b.color, transition: "width 300ms ease-out", borderRadius: "6px" }} />
              </div>
              <div style={{ fontSize: "13px", textAlign: "right", color: tokens.fg, fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString()}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
