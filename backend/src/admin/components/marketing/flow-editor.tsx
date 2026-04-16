import React, { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { sdk } from "../../lib/sdk"
import { useSelectedBrand, StatusBadge, brandQs, fmt, tokens } from "./shared"

type NodeType = "delay" | "email" | "tag" | "condition" | "exit"

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

function blankNode(type: NodeType): FlowNode {
  switch (type) {
    case "delay": return { id: uid(), type, config: { minutes: 60 } }
    case "email": return { id: uid(), type, config: { template_id: "" } }
    case "tag": return { id: uid(), type, config: { tag: "", action: "add" } }
    case "condition": return { id: uid(), type, config: { field: "status", op: "eq", value: "subscribed" } }
    case "exit": return { id: uid(), type, config: {} }
  }
}

export function FlowEditor({ flowId }: { flowId?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { brandId } = useSelectedBrand()
  const bQs = brandQs(brandId)

  const [currentId, setCurrentId] = useState<string | undefined>(flowId)
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [trigger, setTrigger] = useState("event:order.placed")
  const [nodes, setNodes] = useState<FlowNode[]>([])
  const [status, setStatus] = useState<string>("draft")
  const [version, setVersion] = useState<number>(1)
  const [stats, setStats] = useState<any>({})

  const templatesQ = useQuery({
    queryKey: ["mkt-templates-ready", brandId],
    queryFn: () =>
      sdk.client.fetch<{ templates: any[] }>(`/admin/marketing/templates${bQs}${bQs ? "&" : "?"}status=ready`, { method: "GET" }),
    enabled: !!brandId,
  })
  const templates: any[] = ((templatesQ.data as any)?.templates) || []

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
    setStatus(f.status || "draft")
    setVersion(f.version || 1)
    setStats(f.stats || {})
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

  const addNode = (type: NodeType) => setNodes((n) => [...n, blankNode(type)])
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
              templates={templates}
              onUp={() => moveNode(node.id, -1)}
              onDown={() => moveNode(node.id, 1)}
              onDelete={() => removeNode(node.id)}
              onChange={(patch) => updateNodeConfig(node.id, patch)}
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
            {(["delay", "email", "tag", "condition", "exit"] as NodeType[]).map((t) => (
              <button
                key={t}
                onClick={() => addNode(t)}
                className="mkt-btn mkt-btn-sm"
                style={{ textTransform: "capitalize" }}
              >
                + {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {stats && Object.keys(stats).length > 0 && (
        <div className="mkt-card" style={{ padding: "20px" }}>
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
            Stats
          </div>
          <div style={{ display: "flex", gap: "32px", fontSize: "14px", flexWrap: "wrap" }}>
            <div>Runs started: <strong>{fmt(stats.runs_started)}</strong></div>
            <div>Completed: <strong>{fmt(stats.runs_completed)}</strong></div>
            <div>Errored: <strong style={{ color: tokens.dangerFg }}>{fmt(stats.runs_errored)}</strong></div>
          </div>
        </div>
      )}
    </>
  )
}

function NodeCard({
  node, idx, templates, onUp, onDown, onDelete, onChange, isFirst, isLast,
}: {
  node: FlowNode
  idx: number
  templates: any[]
  onUp: () => void
  onDown: () => void
  onDelete: () => void
  onChange: (patch: any) => void
  isFirst: boolean
  isLast: boolean
}) {
  return (
    <div style={{ border: `1px solid ${tokens.border}`, borderRadius: tokens.rMd, padding: "14px 16px", marginBottom: "10px", background: tokens.bg }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: tokens.fgMuted, fontVariantNumeric: "tabular-nums" }}>#{idx + 1}</span>
          <span style={{ fontSize: "12px", fontWeight: 600, color: tokens.fg, textTransform: "uppercase", letterSpacing: "0.04em" }}>{node.type}</span>
        </div>
        <div style={{ display: "flex", gap: "2px" }}>
          <button disabled={isFirst} onClick={onUp} style={{ border: "none", background: "none", cursor: isFirst ? "default" : "pointer", opacity: isFirst ? 0.3 : 1, fontSize: "12px", padding: "2px 6px", color: tokens.fgSecondary, borderRadius: tokens.rSm }}>▲</button>
          <button disabled={isLast} onClick={onDown} style={{ border: "none", background: "none", cursor: isLast ? "default" : "pointer", opacity: isLast ? 0.3 : 1, fontSize: "12px", padding: "2px 6px", color: tokens.fgSecondary, borderRadius: tokens.rSm }}>▼</button>
          <button onClick={onDelete} style={{ border: "none", background: "none", cursor: "pointer", color: tokens.dangerFg, fontSize: "12px", padding: "2px 6px", borderRadius: tokens.rSm }}>✕</button>
        </div>
      </div>
      {node.type === "delay" && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <label style={{ fontSize: "13px", color: tokens.fgSecondary }}>Wait</label>
          <input className="mkt-input" style={{ width: "100px", height: "36px", fontSize: "13px" }} type="number" min={1} value={node.config.minutes ?? 60} onChange={(e) => onChange({ minutes: parseInt(e.target.value) || 0 })} />
          <span style={{ fontSize: "13px", color: tokens.fgSecondary }}>minutes</span>
        </div>
      )}
      {node.type === "email" && (
        <>
          <label className="mkt-label">Template</label>
          <select className="mkt-input" value={node.config.template_id || ""} onChange={(e) => onChange({ template_id: e.target.value })}>
            <option value="">Select template</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </>
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
