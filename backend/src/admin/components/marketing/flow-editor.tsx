import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { sdk } from "../../lib/sdk"
import { useSelectedBrand, StatusBadge, SlideOver, fmt, tokens } from "./shared"
import { SAMPLE_EMAIL_HTML } from "./sample-email-html"

type NodeType = "delay" | "email" | "tag" | "condition" | "exit"

type GoalType = "event" | "product_purchase" | "segment_match" | "tag_added"
type ExitGoal = {
  id: string
  name: string
  type: GoalType
  config: Record<string, any>
  count_as_completed: boolean
}

// Per-type visual identity — color + icon + friendly label. Used in node
// headers, add-node buttons, and connector dots so each step type is
// instantly recognizable at a glance.
const NODE_VISUALS: Record<NodeType, { bg: string; border: string; accent: string; fg: string; icon: string; label: string }> = {
  email:     { bg: "#FAEFF4", border: "#EDD0DC", accent: "#8C2E54", fg: "#6B2240", icon: "✉", label: "Email" },
  delay:     { bg: "#E7F2FB", border: "#CBE0F3", accent: "#0369A1", fg: "#0C4A6E", icon: "⏱", label: "Delay" },
  tag:       { bg: "#E6F6EA", border: "#C6E9D0", accent: "#15803D", fg: "#14532D", icon: "▲", label: "Tag" },
  condition: { bg: "#FBF3D4", border: "#F0E3A7", accent: "#A16207", fg: "#713F12", icon: "◆", label: "Condition" },
  exit:      { bg: "#FCE8E8", border: "#F3C8C8", accent: "#B91C1C", fg: "#7F1D1D", icon: "■", label: "Exit" },
}

type EmailConfig = {
  subject?: string
  preheader?: string
  from_name?: string
  from_email?: string
  reply_to?: string
  html?: string
  editor_type?: "html" | "blocks"
}

type FlowNode = {
  id: string
  type: NodeType
  config: any
}

const TRIGGER_TYPES = [
  { value: "event:order.placed", label: "Event — order.placed" },
  { value: "event:form_submitted", label: "Event — form_submitted" },
  { value: "event:contact_subscribed", label: "Event — contact_subscribed" },
  { value: "time:schedule", label: "Time-based / scheduled" },
]

function uid() { return Math.random().toString(36).slice(2, 10) }

function blankNode(type: NodeType, defaults?: { from_name?: string; from_email?: string; reply_to?: string }): FlowNode {
  switch (type) {
    case "delay": return { id: uid(), type, config: { value: 1, unit: "hours", ms: 60 * 60 * 1000 } }
    case "email": return {
      id: uid(),
      type,
      config: {
        editor_type: "html",
        subject: "de man die zijn vader nooit belde",
        preheader: "Mark wachtte twaalf jaar op het juiste moment. Toen was het te laat.",
        from_name: defaults?.from_name || "",
        from_email: defaults?.from_email || "",
        reply_to: defaults?.reply_to || "",
        html: SAMPLE_EMAIL_HTML,
      } satisfies EmailConfig,
    }
    case "tag": return { id: uid(), type, config: { tag: "", action: "add" } }
    case "condition": return { id: uid(), type, config: { field: "status", op: "eq", value: "subscribed" } }
    case "exit": return { id: uid(), type, config: {} }
  }
}

export function FlowEditor({ flowId }: { flowId?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { brandId } = useSelectedBrand()

  const [currentId, setCurrentId] = useState<string | undefined>(flowId)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [trigger, setTrigger] = useState("event:order.placed")
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [goals, setGoals] = useState<ExitGoal[]>([])
  const [status, setStatus] = useState<string>("draft")
  const [version, setVersion] = useState<number>(1)
  const [editingEmailNodeId, setEditingEmailNodeId] = useState<string | null>(null)

  // Load brand defaults (from_name / from_email / reply_to) to pre-fill new email nodes.
  const brandQ = useQuery({
    queryKey: ["mkt-brand-for-flow", brandId],
    queryFn: () =>
      brandId
        ? sdk.client.fetch<{ brand: any }>(`/admin/marketing/brands/${brandId}`, { method: "GET" })
        : Promise.resolve({ brand: null } as any),
    enabled: !!brandId,
  })
  const brand = (brandQ.data as any)?.brand || null

  const { data: fData } = useQuery({
    queryKey: ["mkt-flow", currentId],
    queryFn: () =>
      currentId
        ? sdk.client.fetch<{ flow: any }>(`/admin/marketing/flows/${currentId}`, { method: "GET" })
        : Promise.resolve({ flow: null } as any),
    enabled: !!currentId,
  })

  useEffect(() => {
    const f = (fData as any)?.flow
    if (!f) return
    setName(f.name || "")
    setDescription(f.description || "")
    setTrigger(f.trigger?.type ? `${f.trigger.type}${f.trigger.event ? `:${f.trigger.event}` : ""}` : "event:order.placed")
    const def = f.definition || {}
    setNodes(Array.isArray(def.nodes) ? def.nodes : [])
    setGoals(Array.isArray(f.goals) ? f.goals : [])
    setStatus(f.status || "draft")
    setVersion(f.version || 1)
  }, [fData])

  const saveMut = useMutation({
    mutationFn: async (overrideStatus?: string) => {
      const [ttype, tevent] = trigger.split(":")
      const body: any = {
        brand_id: brandId || undefined,
        name,
        description,
        trigger: tevent ? { type: ttype, event: tevent } : { type: ttype },
        definition: { nodes, edges: [] },
        goals,
        status: overrideStatus || status,
      }
      if (currentId) {
        return sdk.client.fetch<{ flow: any }>(`/admin/marketing/flows/${currentId}`, { method: "POST", body })
      }
      return sdk.client.fetch<{ flow: any }>(`/admin/marketing/flows`, { method: "POST", body })
    },
    onSuccess: (resp: any) => {
      const f = resp?.flow
      if (f?.id && !currentId) {
        setCurrentId(f.id)
        navigate(`/marketing/flows/${f.id}`, { replace: true })
      }
      if (f?.status) setStatus(f.status)
      qc.invalidateQueries({ queryKey: ["mkt-flows"] })
      qc.invalidateQueries({ queryKey: ["mkt-flow", f?.id] })
      toast.success("Flow saved")
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const addNode = (type: NodeType) =>
    setNodes((n) => [
      ...n,
      blankNode(type, {
        from_name: brand?.marketing_from_name || "",
        from_email: brand?.marketing_from_email || "",
        reply_to: brand?.marketing_reply_to || "",
      }),
    ])
  const removeNode = (id: string) => setNodes((n) => n.filter((x) => x.id !== id))
  const moveNode = (id: string, dir: -1 | 1) =>
    setNodes((n) => {
      const idx = n.findIndex((x) => x.id === id)
      if (idx < 0) return n
      const to = idx + dir
      if (to < 0 || to >= n.length) return n
      const arr = [...n]
      const tmp = arr[idx]; arr[idx] = arr[to]; arr[to] = tmp
      return arr
    })
  const updateNodeConfig = (id: string, patch: any) =>
    setNodes((n) => n.map((x) => (x.id === id ? { ...x, config: { ...x.config, ...patch } } : x)))

  const editingEmailNode = nodes.find((n) => n.id === editingEmailNodeId) || null

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <StatusBadge status={status} />
          <span style={{ fontSize: "13px", color: tokens.fgSecondary }}>v{version}</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="mkt-btn mkt-btn-sm" onClick={() => saveMut.mutate("draft")} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save draft"}
          </button>
          {status === "live" ? (
            <button
              className="mkt-btn mkt-btn-sm"
              onClick={() => saveMut.mutate("paused")}
              style={{ borderColor: tokens.warning, color: tokens.warningFg }}
            >
              Pause
            </button>
          ) : (
            <button className="mkt-btn-primary" onClick={() => saveMut.mutate("live")} disabled={saveMut.isPending}>
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="mkt-card" style={{ padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label className="mkt-label">Name *</label>
            <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mkt-label">Trigger *</label>
            <select className="mkt-input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label className="mkt-label">Description</label>
            <textarea className="mkt-input" style={{ minHeight: "70px" }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      </div>

      <ExitGoalsSection goals={goals} setGoals={setGoals} />

      <div className="mkt-card" style={{ padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: tokens.fgSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            Nodes ({nodes.length})
          </div>
        </div>
        {nodes.length === 0 ? (
          <div
            style={{
              padding: "32px",
              textAlign: "center",
              color: tokens.fgSecondary,
              fontSize: "13px",
              border: `1px dashed ${tokens.borderStrong}`,
              borderRadius: tokens.rMd,
            }}
          >
            No nodes yet — add your first one below.
          </div>
        ) : (
          nodes.map((node, idx) => (
            <NodeCard
              key={node.id}
              node={node}
              idx={idx}
              onUp={() => moveNode(node.id, -1)}
              onDown={() => moveNode(node.id, 1)}
              onDelete={() => removeNode(node.id)}
              onChange={(patch) => updateNodeConfig(node.id, patch)}
              onEditEmail={() => setEditingEmailNodeId(node.id)}
              isFirst={idx === 0}
              isLast={idx === nodes.length - 1}
            />
          ))
        )}
        <div style={{ borderTop: `1px solid ${tokens.borderSubtle}`, marginTop: "14px", paddingTop: "14px" }}>
          <div
            style={{
              fontSize: "11px",
              color: tokens.fgSecondary,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              fontWeight: 600,
              marginBottom: "8px",
            }}
          >
            Add node
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {(["email", "delay", "tag", "condition", "exit"] as NodeType[]).map((t) => {
              const v = NODE_VISUALS[t]
              return (
                <button
                  key={t}
                  onClick={() => addNode(t)}
                  className="mkt-btn mkt-btn-sm"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    borderColor: v.border,
                    color: v.fg,
                    background: "#fff",
                  }}
                >
                  <span
                    aria-hidden
                    style={{
                      display: "inline-flex",
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      background: v.accent,
                      color: "#fff",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "10px",
                      lineHeight: 1,
                    }}
                  >
                    {v.icon}
                  </span>
                  + {v.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {currentId && <FlowStatsPanel flowId={currentId} />}

      {editingEmailNode && (
        <EmailEditorSlideOver
          node={editingEmailNode}
          brand={brand}
          onClose={() => setEditingEmailNodeId(null)}
          onSave={(cfg) => {
            updateNodeConfig(editingEmailNode.id, cfg)
            setEditingEmailNodeId(null)
            toast.success("Email updated")
          }}
        />
      )}
    </>
  )
}

function NodeCard({
  node, idx, onUp, onDown, onDelete, onChange, onEditEmail, isFirst, isLast,
}: {
  node: FlowNode
  idx: number
  onUp: () => void
  onDown: () => void
  onDelete: () => void
  onChange: (patch: any) => void
  onEditEmail: () => void
  isFirst: boolean
  isLast: boolean
}) {
  const visual = NODE_VISUALS[node.type]
  return (
    <div
      style={{
        position: "relative",
        border: `1px solid ${visual.border}`,
        borderRadius: tokens.rMd,
        padding: "14px 16px 14px 20px",
        marginBottom: "10px",
        background: visual.bg,
        overflow: "hidden",
      }}
    >
      {/* Left color strip */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: "4px",
          background: visual.accent,
        }}
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: tokens.fgMuted, fontVariantNumeric: "tabular-nums" }}>#{idx + 1}</span>
          <div
            aria-hidden
            style={{
              width: "22px",
              height: "22px",
              borderRadius: "50%",
              background: visual.accent,
              color: "#fff",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "12px",
              lineHeight: 1,
            }}
            title={visual.label}
          >
            {visual.icon}
          </div>
          <span style={{ fontSize: "12px", fontWeight: 700, color: visual.fg, textTransform: "uppercase", letterSpacing: "0.04em" }}>{visual.label}</span>
        </div>
        <div style={{ display: "flex", gap: "2px" }}>
          <button disabled={isFirst} onClick={onUp} style={{ border: "none", background: "none", cursor: isFirst ? "default" : "pointer", opacity: isFirst ? 0.3 : 1, fontSize: "12px", padding: "2px 6px", color: visual.fg, borderRadius: tokens.rSm }}>▲</button>
          <button disabled={isLast} onClick={onDown} style={{ border: "none", background: "none", cursor: isLast ? "default" : "pointer", opacity: isLast ? 0.3 : 1, fontSize: "12px", padding: "2px 6px", color: visual.fg, borderRadius: tokens.rSm }}>▼</button>
          <button onClick={onDelete} style={{ border: "none", background: "none", cursor: "pointer", color: tokens.dangerFg, fontSize: "12px", padding: "2px 6px", borderRadius: tokens.rSm }}>✕</button>
        </div>
      </div>
      {node.type === "delay" && (
        <DelayNodeBody node={node} onChange={onChange} />
      )}
      {node.type === "email" && (
        <EmailNodeBody node={node} onEdit={onEditEmail} />
      )}
      {node.type === "tag" && (
        <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "8px" }}>
          <select className="mkt-input" value={node.config.action || "add"} onChange={(e) => onChange({ action: e.target.value })}>
            <option value="add">Add tag</option>
            <option value="remove">Remove tag</option>
          </select>
          <input className="mkt-input" value={node.config.tag || ""} onChange={(e) => onChange({ tag: e.target.value })} placeholder="vip" />
        </div>
      )}
      {node.type === "condition" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          <input className="mkt-input" value={node.config.field || ""} onChange={(e) => onChange({ field: e.target.value })} placeholder="field" />
          <select className="mkt-input" value={node.config.op || "eq"} onChange={(e) => onChange({ op: e.target.value })}>
            <option value="eq">equals</option>
            <option value="neq">not equal</option>
            <option value="contains">contains</option>
            <option value="gt">greater than</option>
            <option value="lt">less than</option>
          </select>
          <input className="mkt-input" value={node.config.value ?? ""} onChange={(e) => onChange({ value: e.target.value })} placeholder="value" />
        </div>
      )}
      {node.type === "exit" && (
        <div style={{ fontSize: "13px", color: tokens.fgSecondary }}>Ends the flow for this contact.</div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Delay node body — value + unit dropdown (minutes / hours / days)
// ═══════════════════════════════════════════════════════════════════════
type DelayUnit = "minutes" | "hours" | "days"
const UNIT_MS: Record<DelayUnit, number> = {
  minutes: 60 * 1000,
  hours: 60 * 60 * 1000,
  days: 24 * 60 * 60 * 1000,
}

function DelayNodeBody({ node, onChange }: { node: FlowNode; onChange: (patch: any) => void }) {
  // Infer value/unit from existing node.config — back-compat with legacy `minutes`.
  const legacyMinutes = typeof node.config?.minutes === "number" ? node.config.minutes : null
  const initialUnit: DelayUnit = (node.config?.unit as DelayUnit) ||
    (legacyMinutes != null
      ? legacyMinutes % (60 * 24) === 0
        ? "days"
        : legacyMinutes % 60 === 0
          ? "hours"
          : "minutes"
      : "hours")
  const initialValue: number = typeof node.config?.value === "number"
    ? node.config.value
    : legacyMinutes != null
      ? initialUnit === "days"
        ? legacyMinutes / (60 * 24)
        : initialUnit === "hours"
          ? legacyMinutes / 60
          : legacyMinutes
      : 1

  const value = initialValue
  const unit = initialUnit

  const writeBoth = (v: number, u: DelayUnit) => {
    const safe = Math.max(1, Math.floor(v) || 1)
    onChange({ value: safe, unit: u, ms: safe * UNIT_MS[u] })
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      <label style={{ fontSize: "13px", color: tokens.fgSecondary }}>Wait</label>
      <input
        className="mkt-input"
        style={{ width: "100px", height: "36px", fontSize: "13px" }}
        type="number"
        min={1}
        value={value}
        onChange={(e) => writeBoth(parseInt(e.target.value) || 1, unit)}
      />
      <select
        className="mkt-input"
        style={{ width: "auto", minWidth: "120px", height: "36px", fontSize: "13px" }}
        value={unit}
        onChange={(e) => writeBoth(value, e.target.value as DelayUnit)}
      >
        <option value="minutes">minutes</option>
        <option value="hours">hours</option>
        <option value="days">days</option>
      </select>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Email node body — summary on the left + hover-zoom thumbnail on the right
// ═══════════════════════════════════════════════════════════════════════
function EmailNodeBody({ node, onEdit }: { node: FlowNode; onEdit: () => void }) {
  const cfg: EmailConfig = node.config || {}
  const html = cfg.html || ""
  const [hovered, setHovered] = useState(false)
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null)
  const thumbRef = useRef<HTMLDivElement>(null)

  const onEnter = () => {
    setHovered(true)
    const r = thumbRef.current?.getBoundingClientRect()
    if (r) setHoverPos({ x: r.left, y: r.top })
  }
  const onLeave = () => { setHovered(false); setHoverPos(null) }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 160px", gap: "16px", alignItems: "stretch" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 }}>
        <div>
          <div style={{ fontSize: "10px", color: tokens.fgMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "2px" }}>Subject</div>
          <div style={{ fontSize: "14px", color: cfg.subject ? tokens.fg : tokens.fgMuted, fontWeight: cfg.subject ? 500 : 400, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {cfg.subject || "— not set —"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: tokens.fgMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "2px" }}>Preheader</div>
          <div style={{ fontSize: "13px", color: cfg.preheader ? tokens.fgSecondary : tokens.fgMuted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {cfg.preheader || "—"}
          </div>
        </div>
        <div>
          <div style={{ fontSize: "10px", color: tokens.fgMuted, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: "2px" }}>From</div>
          <div style={{ fontSize: "12px", color: tokens.fgSecondary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {[cfg.from_name, cfg.from_email && `<${cfg.from_email}>`].filter(Boolean).join(" ") || "— uses brand default —"}
          </div>
        </div>
        <div style={{ marginTop: "auto" }}>
          <button className="mkt-btn mkt-btn-sm" onClick={onEdit}>
            Edit email →
          </button>
        </div>
      </div>

      <div
        ref={thumbRef}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        onClick={onEdit}
        style={{
          width: 160,
          height: 210,
          overflow: "hidden",
          border: `1px solid ${tokens.borderSubtle}`,
          borderRadius: tokens.rSm,
          position: "relative",
          cursor: "zoom-in",
          background: "#fff",
          flexShrink: 0,
        }}
        title="Hover to zoom — click to edit"
      >
        <iframe
          title={`Email thumbnail ${node.id}`}
          srcDoc={html || "<p style='padding:20px;color:#999;font:13px sans-serif'>Empty email</p>"}
          sandbox=""
          style={{
            width: 600,
            height: 790,
            border: "none",
            transformOrigin: "top left",
            transform: "scale(0.2667)",
            pointerEvents: "none",
          }}
        />
      </div>

      {hovered && hoverPos && <EmailHoverPreview html={html} anchorX={hoverPos.x} anchorY={hoverPos.y} />}
    </div>
  )
}

// Floating popup next to the thumbnail on hover — full-size 600-wide render.
function EmailHoverPreview({ html, anchorX, anchorY }: { html: string; anchorX: number; anchorY: number }) {
  // Position: to the left of the thumbnail by default, capped at 8px from viewport edges.
  const previewWidth = 620
  const previewHeight = 780
  const pad = 8
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200
  const vh = typeof window !== "undefined" ? window.innerHeight : 800
  let left = anchorX - previewWidth - 12
  if (left < pad) left = pad
  let top = anchorY
  if (top + previewHeight > vh - pad) top = Math.max(pad, vh - previewHeight - pad)
  if (left + previewWidth > vw - pad) left = vw - previewWidth - pad

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width: previewWidth,
        height: previewHeight,
        background: "#fff",
        border: `1px solid ${tokens.borderStrong}`,
        borderRadius: tokens.rMd,
        boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
        zIndex: 2000,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <iframe
        title="Email hover preview"
        srcDoc={html || "<p style='padding:20px;color:#999;font:13px sans-serif'>Empty email</p>"}
        sandbox=""
        style={{ width: "100%", height: "100%", border: "none" }}
      />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// Email editor slide-over — same fields as campaigns, scoped to this node
// ═══════════════════════════════════════════════════════════════════════
function EmailEditorSlideOver({
  node, brand, onClose, onSave,
}: {
  node: FlowNode
  brand: any | null
  onClose: () => void
  onSave: (cfg: EmailConfig) => void
}) {
  const initial: EmailConfig = node.config || {}
  const [subject, setSubject] = useState(initial.subject || "")
  const [preheader, setPreheader] = useState(initial.preheader || "")
  const [fromName, setFromName] = useState(initial.from_name || "")
  const [fromEmail, setFromEmail] = useState(initial.from_email || "")
  const [replyTo, setReplyTo] = useState(initial.reply_to || "")
  const [html, setHtml] = useState(initial.html || "")
  const [activeTab, setActiveTab] = useState<"html" | "preview">("preview")

  const previewDoc = useMemo(() => buildPreviewDocument(html, preheader), [html, preheader])
  const canSave = !!subject && !!html

  return (
    <SlideOver
      title={`Edit email · ${node.id}`}
      onClose={onClose}
      footer={
        <>
          <button className="mkt-btn" onClick={onClose}>Cancel</button>
          <button
            className="mkt-btn-primary"
            disabled={!canSave}
            onClick={() =>
              onSave({
                editor_type: "html",
                subject,
                preheader,
                from_name: fromName,
                from_email: fromEmail,
                reply_to: replyTo,
                html,
              })
            }
          >
            Save email
          </button>
        </>
      }
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "16px" }}>
        <div>
          <label className="mkt-label">Subject *</label>
          <input className="mkt-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Eye-catching subject line" />
        </div>
        <div>
          <label className="mkt-label">Preheader</label>
          <input
            className="mkt-input"
            value={preheader}
            onChange={(e) => setPreheader(e.target.value)}
            placeholder="Preview text shown next to the subject in the inbox"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label className="mkt-label">From name</label>
            <input className="mkt-input" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder={brand?.marketing_from_name || "Your name"} />
          </div>
          <div>
            <label className="mkt-label">From email</label>
            <input className="mkt-input" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder={brand?.marketing_from_email || "news@yourdomain.com"} />
          </div>
        </div>
        <div>
          <label className="mkt-label">Reply-to</label>
          <input className="mkt-input" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder={brand?.marketing_reply_to || "Leave empty to use sender email"} />
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
            <label className="mkt-label" style={{ marginBottom: 0 }}>Email HTML</label>
            <div style={{ display: "flex", gap: "4px", border: `1px solid ${tokens.borderStrong}`, borderRadius: tokens.rSm, padding: "2px" }}>
              <TabButton active={activeTab === "preview"} onClick={() => setActiveTab("preview")}>Preview</TabButton>
              <TabButton active={activeTab === "html"} onClick={() => setActiveTab("html")}>HTML</TabButton>
            </div>
          </div>
          {activeTab === "html" ? (
            <textarea
              className="mkt-input"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
              style={{ minHeight: "420px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px", lineHeight: 1.5 }}
              spellCheck={false}
              placeholder="Paste or edit full HTML here"
            />
          ) : (
            <div style={{ border: `1px solid ${tokens.borderStrong}`, borderRadius: tokens.rMd, background: "#fff", height: "520px", overflow: "hidden" }}>
              <iframe
                title="Email preview"
                srcDoc={previewDoc}
                sandbox=""
                style={{ width: "100%", height: "100%", border: "none" }}
              />
            </div>
          )}
          <div style={{ marginTop: "6px", display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", color: tokens.fgMuted }}>
            <button
              className="mkt-btn mkt-btn-sm"
              onClick={() => {
                if (confirm("Replace current HTML with the sample story template?")) setHtml(SAMPLE_EMAIL_HTML)
              }}
            >
              Load sample
            </button>
            <span>Placeholders like {"{{ first_name }}"}, {"{{ unsubscribe_url }}"}, {"{{ view_in_browser_text/label/url }}"} are merged by the dispatcher.</span>
          </div>
        </div>
      </div>
    </SlideOver>
  )
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: "none",
        background: active ? tokens.surface : "transparent",
        color: active ? tokens.fg : tokens.fgSecondary,
        padding: "4px 10px",
        fontSize: "12px",
        fontWeight: active ? 600 : 400,
        borderRadius: tokens.rSm,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  )
}

// Build a srcdoc that includes a hidden preheader row at the top of body.
function buildPreviewDocument(htmlBody: string, preheader: string): string {
  const preheaderDiv = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;color:transparent;visibility:hidden;mso-hide:all">${escapeHtml(preheader)}</div>`
    : ""
  const safe = (htmlBody || "").replace(/<script[\s\S]*?<\/script>/gi, "")
  if (/<body[^>]*>/i.test(safe)) {
    return safe.replace(/<body([^>]*)>/i, (m) => `${m}${preheaderDiv}`)
  }
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body>${preheaderDiv}${safe}</body></html>`
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

// ═══════════════════════════════════════════════════════════════════════
// Exit goals section — auto-exit the flow when a contact matches a goal
// ═══════════════════════════════════════════════════════════════════════
const GOAL_TYPE_OPTIONS: Array<{ value: GoalType; label: string; hint: string }> = [
  { value: "event", label: "Event happened", hint: "e.g. order.placed, page_viewed, form_submitted" },
  { value: "product_purchase", label: "Bought a product", hint: "filter by keyword or project slug" },
  { value: "segment_match", label: "Joined a segment", hint: "contact matches a saved segment" },
  { value: "tag_added", label: "Got a tag", hint: "contact gained a specific tag" },
]

function goalUid() { return "g_" + Math.random().toString(36).slice(2, 10) }

function ExitGoalsSection({
  goals, setGoals,
}: { goals: ExitGoal[]; setGoals: (g: ExitGoal[]) => void }) {
  const addGoal = () =>
    setGoals([
      ...goals,
      { id: goalUid(), name: "", type: "product_purchase", config: {}, count_as_completed: true },
    ])
  const updateGoal = (id: string, patch: Partial<ExitGoal>) =>
    setGoals(goals.map((g) => (g.id === id ? { ...g, ...patch, config: patch.config ? { ...g.config, ...patch.config } : g.config } : g)))
  const removeGoal = (id: string) => setGoals(goals.filter((g) => g.id !== id))

  return (
    <div className="mkt-card" style={{ padding: "20px", marginBottom: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", fontWeight: 600, color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Exit goals ({goals.length})
          </div>
          <div style={{ fontSize: "12px", color: tokens.fgSecondary, marginTop: "4px" }}>
            Contacts matching any goal below auto-exit the flow. No more emails are sent.
          </div>
        </div>
        <button className="mkt-btn mkt-btn-sm" onClick={addGoal}>+ Add goal</button>
      </div>
      {goals.length === 0 ? (
        <div
          style={{
            padding: "20px",
            textAlign: "center",
            color: tokens.fgMuted,
            fontSize: "13px",
            border: `1px dashed ${tokens.borderStrong}`,
            borderRadius: tokens.rMd,
          }}
        >
          No exit goals — flow runs through all nodes for every contact.
        </div>
      ) : (
        goals.map((goal, idx) => (
          <GoalCard
            key={goal.id}
            goal={goal}
            idx={idx}
            onChange={(patch) => updateGoal(goal.id, patch)}
            onDelete={() => removeGoal(goal.id)}
          />
        ))
      )}
    </div>
  )
}

function GoalCard({
  goal, idx, onChange, onDelete,
}: {
  goal: ExitGoal
  idx: number
  onChange: (patch: Partial<ExitGoal>) => void
  onDelete: () => void
}) {
  return (
    <div style={{ border: `1px solid ${tokens.borderSubtle}`, borderRadius: tokens.rMd, padding: "14px 16px", marginBottom: "8px", background: "#FAFAF9" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontSize: "12px", color: tokens.fgMuted, fontVariantNumeric: "tabular-nums" }}>#{idx + 1}</span>
        <button onClick={onDelete} style={{ border: "none", background: "none", cursor: "pointer", color: tokens.dangerFg, fontSize: "12px", padding: "2px 6px" }}>✕</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label className="mkt-label">Goal name</label>
          <input className="mkt-input" value={goal.name} onChange={(e) => onChange({ name: e.target.value })} placeholder="e.g. Bought Laat los book" />
        </div>
        <div>
          <label className="mkt-label">Type</label>
          <select className="mkt-input" value={goal.type} onChange={(e) => onChange({ type: e.target.value as GoalType, config: {} })}>
            {GOAL_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginTop: "10px" }}>
        <GoalConfigFields goal={goal} onChange={onChange} />
      </div>
      <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", marginTop: "12px", fontSize: "13px", color: tokens.fgSecondary }}>
        <input
          type="checkbox"
          checked={goal.count_as_completed}
          onChange={(e) => onChange({ count_as_completed: e.target.checked })}
        />
        Count as completed (otherwise counted as "exited")
      </label>
    </div>
  )
}

function GoalConfigFields({ goal, onChange }: { goal: ExitGoal; onChange: (patch: Partial<ExitGoal>) => void }) {
  if (goal.type === "event") {
    return (
      <div>
        <label className="mkt-label">Event type</label>
        <input className="mkt-input" value={goal.config?.event_type || ""} onChange={(e) => onChange({ config: { event_type: e.target.value } })} placeholder="order.placed" />
      </div>
    )
  }
  if (goal.type === "product_purchase") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label className="mkt-label">Product title contains</label>
          <input className="mkt-input" value={goal.config?.product_keyword || ""} onChange={(e) => onChange({ config: { product_keyword: e.target.value } })} placeholder="Laat los" />
        </div>
        <div>
          <label className="mkt-label">Project slug (optional)</label>
          <input className="mkt-input" value={goal.config?.project_slug || ""} onChange={(e) => onChange({ config: { project_slug: e.target.value } })} placeholder="loslatenboek" />
        </div>
      </div>
    )
  }
  if (goal.type === "segment_match") {
    return (
      <div>
        <label className="mkt-label">Segment ID</label>
        <input className="mkt-input" value={goal.config?.segment_id || ""} onChange={(e) => onChange({ config: { segment_id: e.target.value } })} placeholder="seg_abc123" />
        <div style={{ fontSize: "12px", color: tokens.fgMuted, marginTop: "4px" }}>Segment-based goals are planned — not yet evaluated at runtime.</div>
      </div>
    )
  }
  if (goal.type === "tag_added") {
    return (
      <div>
        <label className="mkt-label">Tag</label>
        <input className="mkt-input" value={goal.config?.tag || ""} onChange={(e) => onChange({ config: { tag: e.target.value } })} placeholder="customer" />
      </div>
    )
  }
  return null
}

// ═══════════════════════════════════════════════════════════════════════
// Flow stats panel — real-time performance metrics
// ═══════════════════════════════════════════════════════════════════════
function FlowStatsPanel({ flowId }: { flowId: string }) {
  const { data } = useQuery({
    queryKey: ["mkt-flow-stats", flowId],
    queryFn: () =>
      sdk.client.fetch<{
        runs: { started: number; active: number; completed: number; exited: number; errored: number; conversion_rate: number; avg_complete_seconds: number | null }
        exit_reasons: Array<{ reason: string; count: number }>
        revenue: { orders: number; revenue_eur: number }
        nodes: any[]
      }>(`/admin/marketing/flows/${flowId}/stats`, { method: "GET" }),
    refetchInterval: 30000,
  })

  if (!data) return null
  const r = (data as any).runs
  const rev = (data as any).revenue

  const formatDuration = (s: number | null) => {
    if (!s) return "—"
    const d = Math.floor(s / 86400)
    const h = Math.floor((s % 86400) / 3600)
    const m = Math.floor((s % 3600) / 60)
    if (d > 0) return `${d}d ${h}h`
    if (h > 0) return `${h}h ${m}m`
    return `${m}m`
  }

  return (
    <div className="mkt-card" style={{ padding: "20px", marginBottom: "16px" }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "14px" }}>
        Performance
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px", marginBottom: "16px" }}>
        <StatTile icon="🏃" label="Active" value={fmt(r.active)} accent={tokens.info} />
        <StatTile icon="✓" label="Completed" value={fmt(r.completed)} accent={tokens.successFg} />
        <StatTile icon="↗" label="Exited" value={fmt(r.exited)} accent={tokens.fgMuted} />
        <StatTile icon="!" label="Errored" value={fmt(r.errored)} accent={tokens.dangerFg} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <StatTile label="Started total" value={fmt(r.started)} />
        <StatTile label="Conversion rate" value={`${(r.conversion_rate * 100).toFixed(1)}%`} />
        <StatTile label="Avg time to complete" value={formatDuration(r.avg_complete_seconds)} />
        <StatTile label="Orders" value={fmt(rev.orders)} accent={tokens.successFg} />
        <StatTile label="Revenue" value={`€ ${rev.revenue_eur.toFixed(2)}`} accent={tokens.successFg} />
      </div>
      {Array.isArray((data as any).nodes) && (data as any).nodes.length > 0 && (
        <div style={{ marginTop: "18px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "8px" }}>
            Per-email performance
          </div>
          <div style={{ border: `1px solid ${tokens.borderSubtle}`, borderRadius: tokens.rMd, overflow: "hidden" }}>
            <table className="mkt-table" style={{ fontSize: "12px" }}>
              <thead>
                <tr>
                  <th>Node</th><th>Sent</th><th>Opens</th><th>Clicks</th><th>CTR</th><th>CTOR</th><th>Orders</th><th>Revenue</th><th>RPE</th>
                </tr>
              </thead>
              <tbody>
                {(data as any).nodes.map((n: any) => (
                  <tr key={n.flow_node_id}>
                    <td style={{ fontFamily: "ui-monospace, monospace" }}>{n.flow_node_id}</td>
                    <td>{fmt(n.sent)}</td>
                    <td>{fmt(n.opened_unique)} <span style={{ color: tokens.fgMuted }}>({(n.open_rate * 100).toFixed(0)}%)</span></td>
                    <td>{fmt(n.clicked_unique)}</td>
                    <td>{(n.ctr * 100).toFixed(1)}%</td>
                    <td>{(n.ctor * 100).toFixed(1)}%</td>
                    <td>{fmt(n.orders)}</td>
                    <td>€ {n.revenue_eur.toFixed(2)}</td>
                    <td>€ {n.rpe.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ icon, label, value, accent }: { icon?: string; label: string; value: any; accent?: string }) {
  return (
    <div style={{ padding: "10px 14px", border: `1px solid ${tokens.borderSubtle}`, borderRadius: tokens.rMd, background: "#fff" }}>
      <div style={{ fontSize: "11px", color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "4px" }}>
        {icon && <span style={{ marginRight: "4px", color: accent || tokens.fgSecondary }}>{icon}</span>}
        {label}
      </div>
      <div style={{ fontSize: "20px", fontWeight: 700, color: accent || tokens.fg, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  )
}
