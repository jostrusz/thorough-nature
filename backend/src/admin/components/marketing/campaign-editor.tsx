import React, { useEffect, useMemo, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { sdk } from "../../lib/sdk"
import { useSelectedBrand, StatusBadge, brandQs, fmt, tokens } from "./shared"

export function CampaignEditor({ campaignId }: { campaignId?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { brandId } = useSelectedBrand()
  const bQs = brandQs(brandId)

  const [currentId, setCurrentId] = useState<string | undefined>(campaignId)
  const [name, setName] = useState("")
  const [templateId, setTemplateId] = useState("")
  const [listIds, setListIds] = useState<string[]>([])
  const [segmentIds, setSegmentIds] = useState<string[]>([])
  const [suppressionSegmentIds, setSuppressionSegmentIds] = useState<string[]>([])
  const [abTest, setAbTest] = useState(false)
  const [scheduleAt, setScheduleAt] = useState("")
  const [preview, setPreview] = useState<{ count: number; sample: string[] } | null>(null)
  const [status, setStatus] = useState<string>("draft")
  const [sentAt, setSentAt] = useState<string | null>(null)
  const [metrics, setMetrics] = useState<any>({})

  // Load existing
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
    setTemplateId(c.template_id || "")
    setListIds([c.list_id].filter(Boolean) as string[])
    setSegmentIds([c.segment_id].filter(Boolean) as string[])
    setSuppressionSegmentIds(c.suppression_segment_ids || [])
    setAbTest(!!c.ab_test)
    setScheduleAt(c.send_at ? new Date(c.send_at).toISOString().slice(0, 16) : "")
    setStatus(c.status || "draft")
    setSentAt(c.sent_at || null)
    setMetrics(c.metrics || {})
  }, [cData])

  // Load lookups
  const templatesQ = useQuery({
    queryKey: ["mkt-templates-ready", brandId],
    queryFn: () =>
      sdk.client.fetch<{ templates: any[] }>(`/admin/marketing/templates${bQs}${bQs ? "&" : "?"}status=ready`, { method: "GET" }),
    enabled: !!brandId,
  })
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

  const templates: any[] = ((templatesQ.data as any)?.templates) || []
  const lists: any[] = ((listsQ.data as any)?.lists) || []
  const segments: any[] = ((segmentsQ.data as any)?.segments) || []

  const saveMut = useMutation({
    mutationFn: async (overrides?: { status?: string; send_at?: string | null }) => {
      const body: any = {
        brand_id: brandId || undefined,
        name,
        template_id: templateId || undefined,
        list_id: listIds[0] || null,
        segment_id: segmentIds[0] || null,
        suppression_segment_ids: suppressionSegmentIds,
        ab_test: abTest,
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
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const sendNowMut = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/marketing/campaigns/${currentId}/send-now`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mkt-campaigns"] })
      qc.invalidateQueries({ queryKey: ["mkt-campaign", currentId] })
      toast.success("Campaign send started")
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const previewMut = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ count: number; sample: string[] }>(`/admin/marketing/campaigns/${currentId}/recipients`, { method: "GET" }),
    onSuccess: (resp: any) => {
      setPreview({ count: resp?.count ?? 0, sample: resp?.sample ?? [] })
    },
    onError: () => toast.error("Failed to preview recipients"),
  })

  const readOnly = status === "sent" || status === "sending"

  const toggleSel = (arr: string[], set: (v: string[]) => void, id: string) => {
    set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id])
  }

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <StatusBadge status={status} />
          {sentAt && <span style={{ fontSize: "13px", color: tokens.fgSecondary }}>Sent {new Date(sentAt).toLocaleString()}</span>}
        </div>
      </div>

      {readOnly ? (
        <ReadOnlyView
          name={name}
          templateName={templates.find((t) => t.id === templateId)?.name}
          metrics={metrics}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "16px", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* 1. Name + Template */}
            <div className="mkt-card" style={{ padding: "20px" }}>
              <SectionTitle step={1} title="Basics" />
              <label className="mkt-label">Campaign name *</label>
              <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring promo 2026" />
              <label className="mkt-label" style={{ marginTop: "14px" }}>Template *</label>
              <select className="mkt-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">Select a ready template</option>
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {templates.length === 0 && (
                <p style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: "10px", marginBottom: 0 }}>
                  No templates in status "ready". <Link to="/marketing/templates" className="mkt-link">Create one</Link>.
                </p>
              )}
            </div>

            {/* 2. Recipients */}
            <div className="mkt-card" style={{ padding: "20px" }}>
              <SectionTitle step={2} title="Recipients" />
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

            {/* 3. A/B placeholder */}
            <div className="mkt-card" style={{ padding: "20px" }}>
              <SectionTitle step={3} title="A/B test" />
              <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", color: tokens.fg }}>
                <input type="checkbox" checked={abTest} onChange={(e) => setAbTest(e.target.checked)} />
                <span>Enable A/B test <span style={{ color: tokens.fgMuted }}>(setup coming soon)</span></span>
              </label>
            </div>

            {/* 4. Schedule */}
            <div className="mkt-card" style={{ padding: "20px" }}>
              <SectionTitle step={4} title="Schedule" />
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
                <button
                  className="mkt-btn"
                  onClick={() => setScheduleAt("")}
                >
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
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? "Saving…" : "Save draft"}
              </button>
              <button
                className="mkt-btn-primary"
                disabled={!name || !templateId || saveMut.isPending || !scheduleAt}
                onClick={() => saveMut.mutate({ status: "scheduled" })}
              >
                Schedule
              </button>
              <button
                className="mkt-btn-primary"
                disabled={!currentId || sendNowMut.isPending}
                onClick={() => { if (confirm("Send this campaign now?")) sendNowMut.mutate() }}
                style={{ background: tokens.danger }}
              >
                {sendNowMut.isPending ? "Starting…" : "Send now"}
              </button>
            </div>
            {currentId && metrics && Object.keys(metrics).length > 0 && (
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
                  Metrics
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div>Sent: <strong>{fmt(metrics.sent)}</strong></div>
                  <div>Delivered: <strong>{fmt(metrics.delivered)}</strong></div>
                  <div>Opened: <strong>{fmt(metrics.opened)}</strong></div>
                  <div>Clicked: <strong>{fmt(metrics.clicked)}</strong></div>
                  <div>Bounced: <strong>{fmt(metrics.bounced)}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

function SectionTitle({ step, title }: { step: number; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
      <div
        style={{
          width: "24px",
          height: "24px",
          borderRadius: "50%",
          background: tokens.primarySoft,
          color: tokens.primary,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
          fontWeight: 600,
        }}
      >
        {step}
      </div>
      <h3 style={{ fontSize: "15px", fontWeight: 600, color: tokens.fg, margin: 0, letterSpacing: "-0.005em" }}>
        {title}
      </h3>
    </div>
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

function ReadOnlyView({ name, templateName, metrics }: { name: string; templateName?: string; metrics: any }) {
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
      {templateName && <div style={{ fontSize: "13px", color: tokens.fgSecondary, marginBottom: "20px" }}>Template: {templateName}</div>}
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
