import React, { useEffect, useMemo, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { sdk } from "../../lib/sdk"
import { useSelectedBrand, lblStyle, StatusBadge, brandQs, fmt } from "./shared"

export function CampaignEditor({ campaignId }: { campaignId?: string }) {
  const qc = useQueryClient()
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
        try { window.location.hash = `#/marketing/campaigns/${c.id}` } catch { /* ignore */ }
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a href="#/marketing/campaigns" className="mkt-link" style={{ fontSize: "12px" }}>← Back</a>
          <StatusBadge status={status} />
          {sentAt && <span style={{ fontSize: "12px", color: "#8C9196" }}>Sent {new Date(sentAt).toLocaleString()}</span>}
        </div>
      </div>

      {readOnly ? (
        <ReadOnlyView
          name={name}
          templateName={templates.find((t) => t.id === templateId)?.name}
          metrics={metrics}
        />
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "12px", alignItems: "flex-start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* 1. Name + Template */}
            <div className="mkt-card" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px" }}>1. Basics</div>
              <label style={lblStyle}>Campaign name *</label>
              <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Spring promo 2026" />
              <label style={{ ...lblStyle, marginTop: "10px" }}>Template *</label>
              <select className="mkt-input" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                <option value="">— Select a ready template —</option>
                {templates.map((t: any) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {templates.length === 0 && (
                <p style={{ fontSize: "12px", color: "#8C9196", marginTop: "6px" }}>
                  No templates in status “ready”. <a href="#/marketing/templates" className="mkt-link">Create one</a>.
                </p>
              )}
            </div>

            {/* 2. Recipients */}
            <div className="mkt-card" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px" }}>2. Recipients</div>
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
                style={{ marginTop: "10px" }}
              />
              <Checklist
                label="Suppression segments (exclude)"
                items={segments}
                selected={suppressionSegmentIds}
                onChange={(id) => toggleSel(suppressionSegmentIds, setSuppressionSegmentIds, id)}
                style={{ marginTop: "10px" }}
              />
              <div style={{ marginTop: "12px", display: "flex", gap: "8px", alignItems: "center" }}>
                <button
                  className="mkt-btn"
                  onClick={() => previewMut.mutate()}
                  disabled={!currentId || previewMut.isPending}
                  style={{ padding: "5px 12px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", opacity: !currentId ? 0.5 : 1 }}
                >
                  {previewMut.isPending ? "Counting…" : "Preview recipients"}
                </button>
                {!currentId && <span style={{ fontSize: "11px", color: "#8C9196" }}>Save draft first</span>}
              </div>
              {preview && (
                <div style={{ marginTop: "10px", padding: "10px 12px", background: "#F6F6F7", borderRadius: "8px" }}>
                  <div style={{ fontSize: "13px", fontWeight: 600 }}>{fmt(preview.count)} recipient(s)</div>
                  {preview.sample.length > 0 && (
                    <div style={{ fontSize: "11px", color: "#6D7175", marginTop: "4px", maxHeight: "120px", overflow: "auto", fontFamily: "monospace" }}>
                      {preview.sample.slice(0, 100).join(", ")}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. A/B placeholder */}
            <div className="mkt-card" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px" }}>3. A/B test</div>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", color: "#8C9196" }}>
                <input type="checkbox" checked={abTest} onChange={(e) => setAbTest(e.target.checked)} />
                Enable A/B test (setup coming soon)
              </label>
            </div>

            {/* 4. Schedule */}
            <div className="mkt-card" style={{ padding: "16px 18px" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px" }}>4. Schedule</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "8px", alignItems: "end" }}>
                <div>
                  <label style={lblStyle}>Send at</label>
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
                  style={{ padding: "7px 12px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: actions sidebar */}
          <div className="mkt-card" style={{ padding: "16px 18px", position: "sticky", top: "12px" }}>
            <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase", marginBottom: "10px" }}>Actions</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                className="mkt-btn"
                onClick={() => saveMut.mutate({ status: "draft" })}
                disabled={saveMut.isPending}
                style={{ padding: "8px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}
              >
                {saveMut.isPending ? "Saving…" : "Save Draft"}
              </button>
              <button
                className="mkt-btn-primary"
                disabled={!name || !templateId || saveMut.isPending || !scheduleAt}
                onClick={() => saveMut.mutate({ status: "scheduled" })}
                style={{ padding: "8px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF", opacity: (!name || !templateId || !scheduleAt) ? 0.5 : 1 }}
              >
                Schedule
              </button>
              <button
                className="mkt-btn-primary"
                disabled={!currentId || sendNowMut.isPending}
                onClick={() => { if (confirm("Send this campaign now?")) sendNowMut.mutate() }}
                style={{ padding: "8px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#D72C0D", color: "#FFF", opacity: !currentId ? 0.5 : 1 }}
              >
                {sendNowMut.isPending ? "Starting…" : "Send Now"}
              </button>
            </div>
            {currentId && metrics && Object.keys(metrics).length > 0 && (
              <div style={{ marginTop: "16px", fontSize: "12px", color: "#6D7175" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase", marginBottom: "6px" }}>Metrics</div>
                <div>Sent: {fmt(metrics.sent)}</div>
                <div>Delivered: {fmt(metrics.delivered)}</div>
                <div>Opened: {fmt(metrics.opened)}</div>
                <div>Clicked: {fmt(metrics.clicked)}</div>
                <div>Bounced: {fmt(metrics.bounced)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
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
      <label style={lblStyle}>{label}</label>
      {items.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#8C9196" }}>None available</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
          {items.map((it: any) => {
            const on = selected.includes(it.id)
            return (
              <label
                key={it.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "5px 8px",
                  borderRadius: "6px",
                  border: on ? "1.5px solid #008060" : "1px solid #E1E3E5",
                  background: on ? "#F0FFF8" : "#FFF",
                  fontSize: "12px",
                  cursor: "pointer",
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
    { label: "Sent", key: "sent", color: "#6D7175" },
    { label: "Delivered", key: "delivered", color: "#008060" },
    { label: "Opened", key: "opened", color: "#1D4ED8" },
    { label: "Clicked", key: "clicked", color: "#7C3AED" },
    { label: "Bounced", key: "bounced", color: "#D72C0D" },
  ]
  const max = Math.max(1, ...bars.map((b) => Number(metrics?.[b.key]) || 0))
  return (
    <div className="mkt-card" style={{ padding: "18px 22px" }}>
      <div style={{ fontSize: "16px", fontWeight: 600, marginBottom: "4px" }}>{name}</div>
      {templateName && <div style={{ fontSize: "12px", color: "#6D7175", marginBottom: "14px" }}>Template: {templateName}</div>}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {bars.map((b) => {
          const v = Number(metrics?.[b.key]) || 0
          const pc = (v / max) * 100
          return (
            <div key={b.key} style={{ display: "grid", gridTemplateColumns: "90px 1fr 60px", alignItems: "center", gap: "10px" }}>
              <div style={{ fontSize: "12px", color: "#6D7175" }}>{b.label}</div>
              <div style={{ background: "#F1F2F4", borderRadius: "4px", overflow: "hidden", height: "16px" }}>
                <div style={{ width: `${pc}%`, height: "100%", background: b.color, transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: "12px", textAlign: "right" }}>{v.toLocaleString()}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
