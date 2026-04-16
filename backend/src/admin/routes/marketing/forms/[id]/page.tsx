import React, { useEffect, useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { useParams } from "react-router-dom"
import { sdk } from "../../../../lib/sdk"
import {
  MarketingShell,
  StatusBadge,
  useSelectedBrand,
  brandQs,
  Modal,
  lblStyle,
} from "../../../../components/marketing/shared"

const FORM_TYPES = [
  { value: "popup", label: "Popup" },
  { value: "embedded", label: "Embedded" },
  { value: "flyout", label: "Flyout" },
  { value: "banner", label: "Banner" },
  { value: "landing", label: "Landing page" },
]

const FIELD_TYPES = [
  { value: "email", label: "Email" },
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "tel", label: "Phone" },
  { value: "checkbox", label: "Checkbox" },
  { value: "select", label: "Select" },
  { value: "hidden", label: "Hidden" },
]

type Field = { name: string; label: string; type: string; required: boolean }

function FormDetailPage() {
  const params = useParams()
  const qc = useQueryClient()
  const { brandId } = useSelectedBrand()
  const bQs = brandQs(brandId)
  const [id, setId] = useState<string | undefined>(params.id)
  const [showEmbed, setShowEmbed] = useState(false)
  const [embedCode, setEmbedCode] = useState("")

  useEffect(() => {
    if (!id && typeof window !== "undefined") {
      const m = window.location.hash.match(/#\/marketing\/forms\/([^/?#]+)/)
      if (m) setId(m[1])
    }
  }, [id])

  const [name, setName] = useState("")
  const [type, setType] = useState("popup")
  const [slug, setSlug] = useState("")
  const [status, setStatus] = useState<string>("draft")
  const [fields, setFields] = useState<Field[]>([{ name: "email", label: "Email", type: "email", required: true }])
  const [stylingText, setStylingText] = useState('{\n  "theme": "light"\n}')
  const [successActionText, setSuccessActionText] = useState('{\n  "type": "message",\n  "text": "Thanks for subscribing!"\n}')
  const [targetListIds, setTargetListIds] = useState<string[]>([])
  const [doubleOptIn, setDoubleOptIn] = useState<string>("inherit")

  const { data: fData } = useQuery({
    queryKey: ["mkt-form", id],
    queryFn: () =>
      id
        ? sdk.client.fetch<{ form: any }>(`/admin/marketing/forms/${id}`, { method: "GET" })
        : Promise.resolve({ form: null } as any),
    enabled: !!id,
  })

  useEffect(() => {
    const f = (fData as any)?.form
    if (!f) return
    setName(f.name || "")
    setType(f.type || "popup")
    setSlug(f.slug || "")
    setStatus(f.status || "draft")
    setFields(Array.isArray(f.fields) ? f.fields : [])
    setStylingText(JSON.stringify(f.styling ?? {}, null, 2))
    setSuccessActionText(JSON.stringify(f.success_action ?? {}, null, 2))
    setTargetListIds(f.target_list_ids || [])
    setDoubleOptIn(
      f.double_opt_in === true ? "yes" : f.double_opt_in === false ? "no" : "inherit"
    )
  }, [fData])

  const listsQ = useQuery({
    queryKey: ["mkt-lists", brandId],
    queryFn: () =>
      sdk.client.fetch<{ lists: any[] }>(`/admin/marketing/lists${bQs}`, { method: "GET" }),
    enabled: !!brandId,
  })
  const lists: any[] = ((listsQ.data as any)?.lists) || []

  const saveMut = useMutation({
    mutationFn: async (overrideStatus?: string) => {
      let styling: any, success_action: any
      try { styling = JSON.parse(stylingText || "{}") } catch { throw new Error("Styling is not valid JSON") }
      try { success_action = JSON.parse(successActionText || "{}") } catch { throw new Error("Success action is not valid JSON") }
      const body: any = {
        brand_id: brandId || undefined,
        name,
        type,
        slug: slug || undefined,
        fields,
        styling,
        success_action,
        target_list_ids: targetListIds,
        double_opt_in: doubleOptIn === "inherit" ? null : doubleOptIn === "yes",
        status: overrideStatus || status,
      }
      return sdk.client.fetch<{ form: any }>(`/admin/marketing/forms/${id}`, { method: "POST", body })
    },
    onSuccess: (resp: any) => {
      const f = resp?.form
      if (f?.status) setStatus(f.status)
      qc.invalidateQueries({ queryKey: ["mkt-forms"] })
      qc.invalidateQueries({ queryKey: ["mkt-form", id] })
      toast.success("Form saved")
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const embedMut = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ embed_code: string }>(`/admin/marketing/forms/${id}/embed-code`, { method: "GET" }),
    onSuccess: (resp: any) => {
      setEmbedCode(resp?.embed_code || "")
      setShowEmbed(true)
    },
    onError: () => toast.error("Failed to load embed code"),
  })

  const addField = () => setFields([...fields, { name: "", label: "", type: "text", required: false }])
  const updateField = (idx: number, patch: Partial<Field>) =>
    setFields(fields.map((f, i) => (i === idx ? { ...f, ...patch } : f)))
  const removeField = (idx: number) => setFields(fields.filter((_, i) => i !== idx))

  const toggleList = (listId: string) =>
    setTargetListIds((arr) => arr.includes(listId) ? arr.filter((x) => x !== listId) : [...arr, listId])

  return (
    <MarketingShell
      title={name || "Form"}
      subtitle="Edit form configuration and publish"
      active="/marketing/forms"
      right={
        <>
          <a href="#/marketing/forms" className="mkt-link" style={{ fontSize: "12px" }}>← Back</a>
          <StatusBadge status={status} />
        </>
      }
    >
      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", marginBottom: "12px" }}>
        <button className="mkt-btn" disabled={!id} onClick={() => embedMut.mutate()} style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}>
          Get embed code
        </button>
        <button className="mkt-btn" onClick={() => saveMut.mutate("draft")} disabled={saveMut.isPending} style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A" }}>
          {saveMut.isPending ? "Saving…" : "Save Draft"}
        </button>
        <button className="mkt-btn-primary" onClick={() => saveMut.mutate("published")} disabled={saveMut.isPending} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "12px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}>
          Publish
        </button>
      </div>

      <div className="mkt-card" style={{ padding: "16px 18px", marginBottom: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          <div>
            <label style={lblStyle}>Name *</label>
            <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label style={lblStyle}>Type</label>
            <select className="mkt-input" value={type} onChange={(e) => setType(e.target.value)}>
              {FORM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label style={lblStyle}>Slug</label>
            <input className="mkt-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="newsletter-popup" />
          </div>
        </div>

        <div style={{ marginTop: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#6D7175", textTransform: "uppercase", marginBottom: "8px" }}>Fields</div>
          {fields.map((f, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 100px 28px", gap: "6px", marginBottom: "6px" }}>
              <input className="mkt-input" value={f.name} onChange={(e) => updateField(idx, { name: e.target.value })} placeholder="name (snake_case)" />
              <input className="mkt-input" value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} placeholder="Label" />
              <select className="mkt-input" value={f.type} onChange={(e) => updateField(idx, { type: e.target.value })}>
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px" }}>
                <input type="checkbox" checked={f.required} onChange={(e) => updateField(idx, { required: e.target.checked })} />
                Required
              </label>
              <button onClick={() => removeField(idx)} style={{ border: "1px solid #FED3D1", background: "#FFF", color: "#D72C0D", borderRadius: "6px", cursor: "pointer" }}>×</button>
            </div>
          ))}
          <button className="mkt-btn" onClick={addField} style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #E1E3E5", background: "#FFF", color: "#1A1A1A", marginTop: "4px" }}>
            + Add field
          </button>
        </div>
      </div>

      <div className="mkt-card" style={{ padding: "16px 18px", marginBottom: "12px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
          <div>
            <label style={lblStyle}>Styling (JSON)</label>
            <textarea className="mkt-input" style={{ minHeight: "140px", fontFamily: "monospace", fontSize: "12px" }} value={stylingText} onChange={(e) => setStylingText(e.target.value)} />
          </div>
          <div>
            <label style={lblStyle}>Success action (JSON)</label>
            <textarea className="mkt-input" style={{ minHeight: "140px", fontFamily: "monospace", fontSize: "12px" }} value={successActionText} onChange={(e) => setSuccessActionText(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: "12px", display: "grid", gridTemplateColumns: "1fr 240px", gap: "12px" }}>
          <div>
            <label style={lblStyle}>Target lists</label>
            {lists.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#8C9196" }}>No lists available</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px" }}>
                {lists.map((l: any) => {
                  const on = targetListIds.includes(l.id)
                  return (
                    <label key={l.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 8px", borderRadius: "6px", border: on ? "1.5px solid #008060" : "1px solid #E1E3E5", background: on ? "#F0FFF8" : "#FFF", fontSize: "12px", cursor: "pointer" }}>
                      <input type="checkbox" checked={on} onChange={() => toggleList(l.id)} />
                      {l.name}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <div>
            <label style={lblStyle}>Double opt-in (override)</label>
            <select className="mkt-input" value={doubleOptIn} onChange={(e) => setDoubleOptIn(e.target.value)}>
              <option value="inherit">Inherit from brand</option>
              <option value="yes">Force on</option>
              <option value="no">Force off</option>
            </select>
          </div>
        </div>
      </div>

      {showEmbed && (
        <Modal
          title="Embed code"
          onClose={() => setShowEmbed(false)}
          width={640}
          footer={
            <>
              <button className="mkt-btn" onClick={() => setShowEmbed(false)} style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", border: "1px solid #E1E3E5", background: "#FFF", color: "#6D7175" }}>
                Close
              </button>
              <button
                className="mkt-btn-primary"
                onClick={() => { navigator.clipboard.writeText(embedCode); toast.success("Copied") }}
                style={{ padding: "6px 14px", borderRadius: "6px", fontSize: "13px", fontWeight: 500, border: "none", background: "#008060", color: "#FFF" }}
              >
                Copy
              </button>
            </>
          }
        >
          <p style={{ fontSize: "12px", color: "#6D7175", marginTop: 0 }}>
            Paste this into your site where you want the form to appear.
          </p>
          <textarea
            className="mkt-input"
            style={{ minHeight: "220px", fontFamily: "monospace", fontSize: "12px" }}
            readOnly
            value={embedCode}
          />
        </Modal>
      )}
    </MarketingShell>
  )
}

export default FormDetailPage
