import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "@medusajs/ui"
import { sdk } from "../../lib/sdk"
import { useSelectedBrand, StatusBadge, Modal, tokens } from "./shared"

// ═══════════════════════════════════════════
// BLOCK TYPES
// ═══════════════════════════════════════════
type Block =
  | { id: string; type: "text"; content: string; align?: "left" | "center" | "right" }
  | { id: string; type: "heading"; content: string; level: 1 | 2 | 3; align?: "left" | "center" | "right" }
  | { id: string; type: "image"; src: string; alt?: string; href?: string; width?: string }
  | { id: string; type: "button"; label: string; href: string; align?: "left" | "center" | "right"; bgColor?: string; textColor?: string }
  | { id: string; type: "divider" }
  | { id: string; type: "spacer"; height: number }
  | { id: string; type: "footer"; content: string; unsubscribe_url?: string }

const BLOCK_TYPES: { type: Block["type"]; label: string }[] = [
  { type: "text", label: "Text" },
  { type: "heading", label: "Heading" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
  { type: "footer", label: "Footer" },
]

function uid() {
  return Math.random().toString(36).slice(2, 10)
}

function newBlock(type: Block["type"]): Block {
  const id = uid()
  switch (type) {
    case "text": return { id, type, content: "Write something…", align: "left" }
    case "heading": return { id, type, content: "Heading", level: 2, align: "left" }
    case "image": return { id, type, src: "", alt: "", href: "" }
    case "button": return { id, type, label: "Click me", href: "https://", align: "center", bgColor: "#008060", textColor: "#FFFFFF" }
    case "divider": return { id, type }
    case "spacer": return { id, type, height: 24 }
    case "footer": return { id, type, content: "You're receiving this because you subscribed.", unsubscribe_url: "{{unsubscribe_url}}" }
  }
}

// Simple client-side HTML compile so preview works even without backend preview endpoint.
function compileBlocksToHtml(
  blocks: Block[],
  opts: { preheader?: string; subject?: string; brandColor?: string } = {}
) {
  const esc = (s: string) =>
    (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!))

  const blockHtml = blocks.map((b) => {
    switch (b.type) {
      case "text":
        return `<div style="font-size:14px;line-height:1.6;color:#1a1a1a;text-align:${b.align || "left"};margin:12px 0;">${esc(b.content).replace(/\n/g, "<br/>")}</div>`
      case "heading": {
        const size = b.level === 1 ? "28px" : b.level === 2 ? "22px" : "18px"
        return `<h${b.level} style="font-size:${size};color:#1a1a1a;text-align:${b.align || "left"};margin:20px 0 8px 0;">${esc(b.content)}</h${b.level}>`
      }
      case "image": {
        const img = `<img src="${esc(b.src)}" alt="${esc(b.alt || "")}" style="max-width:100%;display:block;margin:0 auto;${b.width ? `width:${esc(b.width)};` : ""}"/>`
        return b.href ? `<a href="${esc(b.href)}">${img}</a>` : `<div style="text-align:center;">${img}</div>`
      }
      case "button":
        return `<div style="text-align:${b.align || "center"};margin:16px 0;"><a href="${esc(b.href)}" style="display:inline-block;padding:10px 22px;background:${esc(b.bgColor || opts.brandColor || "#008060")};color:${esc(b.textColor || "#FFFFFF")};text-decoration:none;border-radius:6px;font-size:14px;font-weight:500;">${esc(b.label)}</a></div>`
      case "divider":
        return `<hr style="border:none;border-top:1px solid #E1E3E5;margin:20px 0;"/>`
      case "spacer":
        return `<div style="height:${b.height}px;"></div>`
      case "footer":
        return `<div style="font-size:12px;color:#8c9196;text-align:center;margin:24px 0 8px 0;padding-top:16px;border-top:1px solid #eee;">${esc(b.content)}<br/>${b.unsubscribe_url ? `<a href="${esc(b.unsubscribe_url)}" style="color:#8c9196;">Unsubscribe</a>` : ""}</div>`
    }
  }).join("\n")

  return `<!doctype html><html><head><meta charset="utf-8"/><title>${esc(opts.subject || "")}</title></head><body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
${opts.preheader ? `<div style="display:none;max-height:0;overflow:hidden;">${esc(opts.preheader)}</div>` : ""}
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f6f7;"><tr><td align="center" style="padding:24px 12px;">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:10px;max-width:100%;"><tr><td style="padding:32px 36px;">
${blockHtml}
</td></tr></table>
</td></tr></table>
</body></html>`
}

export function TemplateEditor({ templateId }: { templateId?: string }) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { brandId } = useSelectedBrand()
  const isNew = !templateId

  const [name, setName] = useState("")
  const [subject, setSubject] = useState("")
  const [preheader, setPreheader] = useState("")
  const [fromName, setFromName] = useState("")
  const [fromEmail, setFromEmail] = useState("")
  const [replyTo, setReplyTo] = useState("")
  const [editorType, setEditorType] = useState<"blocks" | "html">("blocks")
  const [blocks, setBlocks] = useState<Block[]>([])
  const [customHtml, setCustomHtml] = useState("")
  const [status, setStatus] = useState<string>("draft")
  const [currentId, setCurrentId] = useState<string | undefined>(templateId)
  const [showTestSend, setShowTestSend] = useState(false)
  const [testEmail, setTestEmail] = useState("")
  const [previewHtml, setPreviewHtml] = useState("")
  const debounceRef = useRef<any>(null)

  // Load existing template
  const { data: tplData, isLoading } = useQuery({
    queryKey: ["mkt-template", currentId],
    queryFn: () =>
      currentId
        ? sdk.client.fetch<{ template: any }>(`/admin/marketing/templates/${currentId}`, { method: "GET" })
        : Promise.resolve({ template: null } as any),
    enabled: !!currentId,
  })

  useEffect(() => {
    const t = (tplData as any)?.template
    if (!t) return
    setName(t.name || "")
    setSubject(t.subject || "")
    setPreheader(t.preheader || "")
    setFromName(t.from_name || "")
    setFromEmail(t.from_email || "")
    setReplyTo(t.reply_to || "")
    setStatus(t.status || "draft")
    if (t.editor_type === "html") {
      setEditorType("html")
      setCustomHtml(t.custom_html || "")
    } else {
      setEditorType("blocks")
      setBlocks(t.block_json?.blocks || [])
      setCustomHtml(t.custom_html || "")
    }
  }, [tplData])

  // Live preview (client-side compile; attempt server preview after save)
  const renderPreview = () => {
    if (editorType === "html") {
      setPreviewHtml(customHtml || "<div style='padding:40px;font-family:sans-serif;color:#8c9196;'>Empty HTML</div>")
    } else {
      setPreviewHtml(compileBlocksToHtml(blocks, { preheader, subject }))
    }
  }

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(renderPreview, 500)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, customHtml, editorType, preheader, subject])

  const saveMut = useMutation({
    mutationFn: async (overrideStatus?: string) => {
      const body: any = {
        brand_id: brandId || undefined,
        name,
        subject,
        preheader,
        from_name: fromName || undefined,
        from_email: fromEmail || undefined,
        reply_to: replyTo || undefined,
        editor_type: editorType,
        block_json: editorType === "blocks" ? { blocks } : undefined,
        custom_html: editorType === "html" ? customHtml : undefined,
        status: overrideStatus || status,
      }
      if (currentId) {
        return sdk.client.fetch<{ template: any }>(`/admin/marketing/templates/${currentId}`, { method: "POST", body })
      }
      return sdk.client.fetch<{ template: any }>(`/admin/marketing/templates`, { method: "POST", body })
    },
    onSuccess: (resp: any) => {
      const t = resp?.template
      if (t?.id && !currentId) {
        setCurrentId(t.id)
        navigate(`/marketing/templates/${t.id}`, { replace: true })
      }
      if (t?.status) setStatus(t.status)
      qc.invalidateQueries({ queryKey: ["mkt-templates"] })
      qc.invalidateQueries({ queryKey: ["mkt-template", t?.id] })
      toast.success("Template saved")
    },
    onError: (e: any) => toast.error("Failed to save: " + (e?.message || "unknown")),
  })

  const testSendMut = useMutation({
    mutationFn: (to: string) =>
      sdk.client.fetch(`/admin/marketing/templates/${currentId}/test-send`, {
        method: "POST",
        body: { to_email: to, brand_id: brandId || undefined },
      }),
    onSuccess: () => {
      toast.success("Test email sent")
      setShowTestSend(false)
    },
    onError: (e: any) => toast.error("Failed: " + (e?.message || "unknown")),
  })

  const addBlock = (type: Block["type"]) => setBlocks((b) => [...b, newBlock(type)])
  const removeBlock = (id: string) => setBlocks((b) => b.filter((x) => x.id !== id))
  const moveBlock = (id: string, dir: -1 | 1) =>
    setBlocks((b) => {
      const idx = b.findIndex((x) => x.id === id)
      if (idx < 0) return b
      const to = idx + dir
      if (to < 0 || to >= b.length) return b
      const arr = [...b]
      const tmp = arr[idx]
      arr[idx] = arr[to]
      arr[to] = tmp
      return arr
    })
  const updateBlock = (id: string, patch: any) =>
    setBlocks((b) => b.map((x) => (x.id === id ? ({ ...x, ...patch } as Block) : x)))

  const statusBadge = useMemo(() => <StatusBadge status={status} />, [status])

  return (
    <>
      {/* Header actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "16px",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span>{statusBadge}</span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button className="mkt-btn mkt-btn-sm" disabled={!currentId} onClick={() => setShowTestSend(true)}>
            Test send to me
          </button>
          <button className="mkt-btn mkt-btn-sm" onClick={() => saveMut.mutate("draft")} disabled={saveMut.isPending}>
            {saveMut.isPending ? "Saving…" : "Save draft"}
          </button>
          <button className="mkt-btn-primary" onClick={() => saveMut.mutate("ready")} disabled={saveMut.isPending}>
            Mark ready
          </button>
        </div>
      </div>

      {/* Template meta */}
      <div className="mkt-card" style={{ padding: "20px", marginBottom: "16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <label className="mkt-label">Name *</label>
            <input className="mkt-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Welcome email" />
          </div>
          <div>
            <label className="mkt-label">Subject *</label>
            <input className="mkt-input" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Welcome to Laat los" />
          </div>
          <div style={{ gridColumn: "span 2" }}>
            <label className="mkt-label">Preheader (hidden preview text)</label>
            <input className="mkt-input" value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Start your journey" />
          </div>
          <div>
            <label className="mkt-label">From name (override)</label>
            <input className="mkt-input" value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="mkt-label">From email (override)</label>
            <input className="mkt-input" type="email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <label className="mkt-label">Reply-to (override)</label>
            <input className="mkt-input" type="email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} placeholder="Optional" />
          </div>
        </div>
      </div>

      {/* Split pane */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 440px) 1fr", gap: "16px", alignItems: "flex-start" }}>
        {/* LEFT: block list */}
        <div className="mkt-card" style={{ padding: "20px", position: "sticky", top: "16px" }}>
          <div
            style={{
              display: "flex",
              gap: "4px",
              background: tokens.borderSubtle,
              borderRadius: tokens.rMd,
              padding: "4px",
              marginBottom: "16px",
            }}
          >
            {(["blocks", "html"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setEditorType(t)}
                style={{
                  flex: 1,
                  padding: "7px",
                  borderRadius: tokens.rSm,
                  fontSize: "13px",
                  fontWeight: editorType === t ? 600 : 500,
                  cursor: "pointer",
                  border: "none",
                  background: editorType === t ? tokens.surface : "transparent",
                  color: editorType === t ? tokens.fg : tokens.fgSecondary,
                  boxShadow: editorType === t ? tokens.shadowSm : "none",
                  transition: "background 150ms ease-out",
                }}
              >
                {t === "blocks" ? "Blocks" : "HTML"}
              </button>
            ))}
          </div>

          {editorType === "html" ? (
            <div>
              <label className="mkt-label">Custom HTML</label>
              <textarea
                className="mkt-input"
                style={{ minHeight: "420px", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: "13px" }}
                value={customHtml}
                onChange={(e) => setCustomHtml(e.target.value)}
                placeholder="<html>…</html>"
              />
            </div>
          ) : (
            <>
              {isLoading && currentId ? (
                <p style={{ color: tokens.fgSecondary, fontSize: "13px" }}>Loading…</p>
              ) : (
                <>
                  {blocks.length === 0 && (
                    <div
                      style={{
                        padding: "24px",
                        textAlign: "center",
                        color: tokens.fgSecondary,
                        fontSize: "13px",
                        border: `1px dashed ${tokens.borderStrong}`,
                        borderRadius: tokens.rMd,
                        marginBottom: "12px",
                      }}
                    >
                      No blocks yet — add one below.
                    </div>
                  )}
                  {blocks.map((b, idx) => (
                    <BlockCard
                      key={b.id}
                      block={b}
                      onChange={(patch) => updateBlock(b.id, patch)}
                      onDelete={() => removeBlock(b.id)}
                      onUp={() => moveBlock(b.id, -1)}
                      onDown={() => moveBlock(b.id, 1)}
                      isFirst={idx === 0}
                      isLast={idx === blocks.length - 1}
                    />
                  ))}

                  <div style={{ borderTop: `1px solid ${tokens.borderSubtle}`, marginTop: "12px", paddingTop: "12px" }}>
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
                      Add block
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                      {BLOCK_TYPES.map((t) => (
                        <button
                          key={t.type}
                          onClick={() => addBlock(t.type)}
                          className="mkt-btn mkt-btn-sm"
                          style={{ justifyContent: "flex-start" }}
                        >
                          + {t.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* RIGHT: preview */}
        <div className="mkt-card" style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: `1px solid ${tokens.borderSubtle}`,
              fontSize: "12px",
              color: tokens.fgSecondary,
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              background: tokens.bg,
            }}
          >
            Preview
          </div>
          <iframe
            title="template-preview"
            srcDoc={previewHtml}
            style={{ width: "100%", height: "720px", border: "none", background: tokens.bg }}
            sandbox=""
          />
        </div>
      </div>

      {showTestSend && (
        <Modal
          title="Send test email"
          onClose={() => setShowTestSend(false)}
          footer={
            <>
              <button className="mkt-btn" onClick={() => setShowTestSend(false)}>Cancel</button>
              <button
                className="mkt-btn-primary"
                disabled={!testEmail || testSendMut.isPending}
                onClick={() => testSendMut.mutate(testEmail)}
              >
                {testSendMut.isPending ? "Sending…" : "Send test"}
              </button>
            </>
          }
        >
          <label className="mkt-label">Email address</label>
          <input
            className="mkt-input"
            type="email"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder="you@example.com"
            autoFocus
          />
          <p style={{ fontSize: "13px", color: tokens.fgSecondary, marginTop: "12px", marginBottom: 0 }}>
            Saves current draft and sends a test copy.
          </p>
        </Modal>
      )}
    </>
  )
}

// ═══════════════════════════════════════════
// BLOCK CARD
// ═══════════════════════════════════════════
function BlockCard({
  block,
  onChange,
  onDelete,
  onUp,
  onDown,
  isFirst,
  isLast,
}: {
  block: Block
  onChange: (patch: any) => void
  onDelete: () => void
  onUp: () => void
  onDown: () => void
  isFirst: boolean
  isLast: boolean
}) {
  return (
    <div style={{ border: `1px solid ${tokens.border}`, borderRadius: tokens.rMd, padding: "12px 14px", marginBottom: "8px", background: tokens.bg }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
        <span style={{ fontSize: "11px", fontWeight: 600, color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>{block.type}</span>
        <div style={{ display: "flex", gap: "2px" }}>
          <button disabled={isFirst} onClick={onUp} style={{ border: "none", background: "none", cursor: isFirst ? "default" : "pointer", opacity: isFirst ? 0.3 : 1, fontSize: "12px", padding: "2px 6px", color: tokens.fgSecondary, borderRadius: tokens.rSm }}>▲</button>
          <button disabled={isLast} onClick={onDown} style={{ border: "none", background: "none", cursor: isLast ? "default" : "pointer", opacity: isLast ? 0.3 : 1, fontSize: "12px", padding: "2px 6px", color: tokens.fgSecondary, borderRadius: tokens.rSm }}>▼</button>
          <button onClick={onDelete} style={{ border: "none", background: "none", cursor: "pointer", color: tokens.dangerFg, fontSize: "12px", padding: "2px 6px", borderRadius: tokens.rSm }}>✕</button>
        </div>
      </div>
      {block.type === "text" && (
        <>
          <textarea className="mkt-input" style={{ minHeight: "60px", fontFamily: "inherit" }} value={block.content} onChange={(e) => onChange({ content: e.target.value })} />
          <AlignPicker value={block.align || "left"} onChange={(v) => onChange({ align: v })} />
        </>
      )}
      {block.type === "heading" && (
        <>
          <input className="mkt-input" value={block.content} onChange={(e) => onChange({ content: e.target.value })} />
          <div style={{ display: "flex", gap: "10px", marginTop: "8px", alignItems: "center" }}>
            <label style={{ fontSize: "12px", color: tokens.fgSecondary }}>Level:</label>
            <select className="mkt-input" style={{ width: "auto", height: "36px", fontSize: "13px" }} value={block.level} onChange={(e) => onChange({ level: parseInt(e.target.value) })}>
              <option value={1}>H1</option>
              <option value={2}>H2</option>
              <option value={3}>H3</option>
            </select>
            <AlignPicker value={block.align || "left"} onChange={(v) => onChange({ align: v })} />
          </div>
        </>
      )}
      {block.type === "image" && (
        <>
          <label className="mkt-label">Image URL</label>
          <input className="mkt-input" value={block.src} onChange={(e) => onChange({ src: e.target.value })} placeholder="https://…" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "8px" }}>
            <input className="mkt-input" value={block.alt || ""} onChange={(e) => onChange({ alt: e.target.value })} placeholder="Alt text" />
            <input className="mkt-input" value={block.href || ""} onChange={(e) => onChange({ href: e.target.value })} placeholder="Link URL (optional)" />
          </div>
          <input className="mkt-input" style={{ marginTop: "8px" }} value={block.width || ""} onChange={(e) => onChange({ width: e.target.value })} placeholder="Width (e.g. 300px)" />
        </>
      )}
      {block.type === "button" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
            <input className="mkt-input" value={block.label} onChange={(e) => onChange({ label: e.target.value })} placeholder="Label" />
            <input className="mkt-input" value={block.href} onChange={(e) => onChange({ href: e.target.value })} placeholder="https://" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "8px", alignItems: "flex-end" }}>
            <div>
              <label style={{ fontSize: "11px", color: tokens.fgSecondary, display: "block", marginBottom: "4px" }}>BG</label>
              <input type="color" value={block.bgColor || "#15803D"} onChange={(e) => onChange({ bgColor: e.target.value })} style={{ width: "100%", height: "36px", padding: "2px", border: `1px solid ${tokens.borderStrong}`, borderRadius: tokens.rMd, cursor: "pointer" }} />
            </div>
            <div>
              <label style={{ fontSize: "11px", color: tokens.fgSecondary, display: "block", marginBottom: "4px" }}>Text</label>
              <input type="color" value={block.textColor || "#FFFFFF"} onChange={(e) => onChange({ textColor: e.target.value })} style={{ width: "100%", height: "36px", padding: "2px", border: `1px solid ${tokens.borderStrong}`, borderRadius: tokens.rMd, cursor: "pointer" }} />
            </div>
            <div>
              <AlignPicker value={block.align || "center"} onChange={(v) => onChange({ align: v })} />
            </div>
          </div>
        </>
      )}
      {block.type === "divider" && (
        <div style={{ fontSize: "13px", color: tokens.fgSecondary }}>A horizontal line.</div>
      )}
      {block.type === "spacer" && (
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <label style={{ fontSize: "12px", color: tokens.fgSecondary }}>Height</label>
          <input className="mkt-input" style={{ width: "100px", height: "36px", fontSize: "13px" }} type="number" min={4} value={block.height} onChange={(e) => onChange({ height: parseInt(e.target.value) || 0 })} />
          <span style={{ fontSize: "12px", color: tokens.fgMuted }}>px</span>
        </div>
      )}
      {block.type === "footer" && (
        <>
          <textarea className="mkt-input" style={{ minHeight: "60px" }} value={block.content} onChange={(e) => onChange({ content: e.target.value })} />
          <input className="mkt-input" style={{ marginTop: "8px" }} value={block.unsubscribe_url || ""} onChange={(e) => onChange({ unsubscribe_url: e.target.value })} placeholder="{{unsubscribe_url}}" />
        </>
      )}
    </div>
  )
}

function AlignPicker({ value, onChange }: { value: string; onChange: (v: "left" | "center" | "right") => void }) {
  return (
    <div style={{ display: "inline-flex", border: `1px solid ${tokens.borderStrong}`, borderRadius: tokens.rMd, overflow: "hidden" }}>
      {(["left", "center", "right"] as const).map((v) => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            padding: "6px 12px",
            fontSize: "12px",
            fontWeight: 500,
            border: "none",
            background: value === v ? tokens.primary : tokens.surface,
            color: value === v ? "#FFFFFF" : tokens.fgSecondary,
            cursor: "pointer",
          }}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
