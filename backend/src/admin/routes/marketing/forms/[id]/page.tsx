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
  tokens,
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
  const id = params.id
  const [showEmbed, setShowEmbed] = useState(false)
  const [embedCode, setEmbedCode] = useState("")

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
      breadcrumbs={[
        { label: "Marketing", to: "/marketing" },
        { label: "Forms", to: "/marketing/forms" },
        { label: name || "Detail" },
      ]}
      right={<StatusBadge status={status} />}
    >
      <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginBottom: "16px" }}>
        <button className="mkt-btn mkt-btn-sm" disabled={!id} onClick={() => embedMut.mutate()}>
          Get embed code
        </button>
        <button className="mkt-btn mkt-btn-sm" onClick={() => saveMut.mutate("draft")} disabled={saveMut.isPending}>
          {saveMut.isPending ? "Saving…" : "Save draft"}
        </button>
        <button className="mkt-btn-primary" onClick={() => saveMut.mutate("published")} disabled={saveMut.isPending}>
          Publish
        </button>
      </div>

      <div className="mkt-card" style={{ padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
          <div>
            <label className="mkt-label">Name *</label>
            <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="mkt-label">Type</label>
            <select className="mkt-input" value={type} onChange={(e) => setType(e.target.value)}>
              {FORM_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mkt-label">Slug</label>
            <input className="mkt-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="newsletter-popup" />
          </div>
        </div>

        <div style={{ marginTop: "24px" }}>
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
            Fields
          </div>
          {fields.map((f, idx) => (
            <div key={idx} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 110px 40px", gap: "8px", marginBottom: "8px", alignItems: "center" }}>
              <input className="mkt-input" value={f.name} onChange={(e) => updateField(idx, { name: e.target.value })} placeholder="name (snake_case)" />
              <input className="mkt-input" value={f.label} onChange={(e) => updateField(idx, { label: e.target.value })} placeholder="Label" />
              <select className="mkt-input" value={f.type} onChange={(e) => updateField(idx, { type: e.target.value })}>
                {FIELD_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", color: tokens.fg, userSelect: "none" }}>
                <input type="checkbox" checked={f.required} onChange={(e) => updateField(idx, { required: e.target.checked })} />
                Required
              </label>
              <button
                onClick={() => removeField(idx)}
                className="mkt-btn-danger-ghost"
                style={{ border: `1px solid ${tokens.borderStrong}`, height: "40px", justifyContent: "center" }}
                aria-label="Remove field"
              >
                ×
              </button>
            </div>
          ))}
          <button className="mkt-btn mkt-btn-sm" onClick={addField} style={{ marginTop: "4px" }}>
            + Add field
          </button>
        </div>
      </div>

      <div className="mkt-card" style={{ padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
          <div>
            <label className="mkt-label">Styling (JSON)</label>
            <textarea className="mkt-input" style={{ minHeight: "160px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "13px" }} value={stylingText} onChange={(e) => setStylingText(e.target.value)} />
          </div>
          <div>
            <label className="mkt-label">Success action (JSON)</label>
            <textarea className="mkt-input" style={{ minHeight: "160px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "13px" }} value={successActionText} onChange={(e) => setSuccessActionText(e.target.value)} />
          </div>
        </div>

        <div style={{ marginTop: "20px", display: "grid", gridTemplateColumns: "1fr 260px", gap: "20px" }}>
          <div>
            <label className="mkt-label">Target lists</label>
            {lists.length === 0 ? (
              <div style={{ fontSize: "13px", color: tokens.fgMuted }}>No lists available</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                {lists.map((l: any) => {
                  const on = targetListIds.includes(l.id)
                  return (
                    <label
                      key={l.id}
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
                      <input type="checkbox" checked={on} onChange={() => toggleList(l.id)} />
                      {l.name}
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <div>
            <label className="mkt-label">Double opt-in (override)</label>
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
          width={720}
          footer={
            <>
              <button className="mkt-btn" onClick={() => setShowEmbed(false)}>Close</button>
              <button
                className="mkt-btn-primary"
                onClick={() => { navigator.clipboard.writeText(embedCode); toast.success("Copied") }}
              >
                Copy
              </button>
            </>
          }
        >
          <p style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: 0 }}>
            Paste this into your site where you want the form to appear.
          </p>
          <textarea
            className="mkt-input"
            style={{ minHeight: "240px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "12px" }}
            readOnly
            value={embedCode}
          />
        </Modal>
      )}
    </MarketingShell>
  )
}

export default FormDetailPage
