import React, { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { sdk } from "../../lib/sdk"
import { useSelectedBrand, lblStyle, StatusBadge, brandQs, fmt } from "./shared"

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
    setNodes(Array.isArray(f.nodes) ? f.nodes : [])
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
        nodes,
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
        try { window.location.hash = `#/marketing/flows/${f.id}` } catch { /* ignore */ }
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <a href="#/marketing/flows" className="mkt-link" style={{ fontSize: "12px" }}>← Back to flows</a>
          <StatusBadge status={status} />
          <span style={{ fontSize: "12px", color: "#8C9196" }}>v{version}</span>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button className="mkt-btn" onClick={() => saveMut.mutate("draft")} disabled={saveMut.isPending} style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}>
            {saveMut.isPending ? "Saving…" : "Save Draft"}
          </button>
          {status === "live" ? (
            <button className="mkt-btn" onClick={() => saveMut.mutate("paused")} style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", border: "1px solid #FED7AA", background: "#FFF", color: "#9A3412" }}>
              Pause
            </button>
          ) : (
            <button className="mkt-btn-primary" onClick={() => saveMut.mutate("live")} disabled={saveMut.isPending} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}>
              Publish
            </button>
          )}
        </div>
      </div>

      <div className="mkt-card" style={{ padding: "16px 18px", marginBottom: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
          <div>
            <label style={lblStyle}>Name *</label>
            <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label style={lblStyle}>Trigger *</label>
            <select className="mkt-input" value={trigger} onChange={(e) => setTrigger(e.target.value)}>
              {TRIGGER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label style={lblStyle}>Description</label>
            <textarea className="mkt-input" style={{ minHeight: "50px", fontFamily: "inherit" }} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
      </div>

      <div className="mkt-card" style={{ padding: "16px 18px", marginBottom: "12px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase" }}>Nodes ({nodes.length})</div>
        </div>
        {nodes.length === 0 ? (
          <div style={{ padding: "16px", textAlign: "center", color: "#8C9196", fontSize: "12px", border: "1px dashed #E1E3E5", borderRadius: "8px" }}>
            No nodes yet.
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
        <div style={{ borderTop: "1px solid #E1E3E5", marginTop: "10px", paddingTop: "10px" }}>
          <div style={{ fontSize: "11px", color: "#6D7175", textTransform: "uppercase", fontWeight: 600, marginBottom: "6px" }}>+ Add node</div>
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {(["delay", "email", "tag", "condition", "exit"] as NodeType[]).map((t) => (
              <button key={t} onClick={() => addNode(t)} className="mkt-btn" style={{ padding: "6px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", textTransform: "capitalize" }}>
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {stats && Object.keys(stats).length > 0 && (
        <div className="mkt-card" style={{ padding: "16px 18px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px" }}>Stats</div>
          <div style={{ display: "flex", gap: "20px", fontSize: "13px" }}>
            <div>Runs started: <strong>{fmt(stats.runs_started)}</strong></div>
            <div>Completed: <strong>{fmt(stats.runs_completed)}</strong></div>
            <div>Errored: <strong style={{ color: "#D72C0D" }}>{fmt(stats.runs_errored)}</strong></div>
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
    <div style={{ border: "1px solid #E1E3E5", borderRadius: "8px", padding: "10px 14px", marginBottom: "8px", background: "#FAFAFA" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "11px", color: "#8C9196" }}>#{idx + 1}</span>
          <span style={{ fontSize: "12px", fontWeight: 700, color: "#1A1A1A", textTransform: "uppercase" }}>{node.type}</span>
        </div>
        <div style={{ display: "flex", gap: "2px" }}>
          <button disabled={isFirst} onClick={onUp} style={{ border: "none", background: "none", cursor: isFirst ? "default" : "pointer", opacity: isFirst ? 0.3 : 1, fontSize: "12px", padding: "2px 4px" }}>▲</button>
          <button disabled={isLast} onClick={onDown} style={{ border: "none", background: "none", cursor: isLast ? "default" : "pointer", opacity: isLast ? 0.3 : 1, fontSize: "12px", padding: "2px 4px" }}>▼</button>
          <button onClick={onDelete} style={{ border: "none", background: "none", cursor: "pointer", color: "#D72C0D", fontSize: "12px", padding: "2px 4px" }}>✕</button>
        </div>
      </div>
      {node.type === "delay" && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "11px", color: "#6D7175" }}>Wait</label>
          <input className="mkt-input" style={{ width: "90px" }} type="number" min={1} value={node.config.minutes ?? 60} onChange={(e) => onChange({ minutes: parseInt(e.target.value) || 0 })} />
          <span style={{ fontSize: "11px", color: "#6D7175" }}>minutes</span>
        </div>
      )}
      {node.type === "email" && (
        <>
          <label style={lblStyle}>Template</label>
          <select className="mkt-input" value={node.config.template_id || ""} onChange={(e) => onChange({ template_id: e.target.value })}>
            <option value="">— Select template —</option>
            {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </>
      )}
      {node.type === "tag" && (
        <div style={{ display: "grid", gridTemplateColumns: "140px 1fr", gap: "6px" }}>
          <select className="mkt-input" value={node.config.action || "add"} onChange={(e) => onChange({ action: e.target.value })}>
            <option value="add">Add tag</option>
            <option value="remove">Remove tag</option>
          </select>
          <input className="mkt-input" value={node.config.tag || ""} onChange={(e) => onChange({ tag: e.target.value })} placeholder="vip" />
        </div>
      )}
      {node.type === "condition" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
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
        <div style={{ fontSize: "12px", color: "#8C9196" }}>Ends the flow for this contact.</div>
      )}
    </div>
  )
}
