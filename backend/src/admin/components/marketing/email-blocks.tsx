// @ts-nocheck
import React from "react"
import { tokens } from "./shared"

/**
 * email-blocks.tsx — the visual block builder for the campaign editor.
 *
 * A non-technical user assembles an email from typed blocks (heading, text,
 * image, button, divider, spacer). The blocks are:
 *   1. Persisted as JSON in `campaign.metadata.blocks` so they can be re-edited.
 *   2. Compiled to responsive, inline-CSS, 600px table-based HTML
 *      (`compileBlocksToHtml`) — that compiled HTML becomes `custom_html`,
 *      which is what the dispatcher actually sends.
 *
 * Compiler rules (kept deliberately simple + robust):
 *   - Table layout, inline styles only (email clients ignore <style>/flex/grid).
 *   - All user text is HTML-escaped, THEN a tiny inline-markdown pass adds
 *     *bold* and [text](url) links on the already-escaped string, so user
 *     input can never break the markup.
 *   - {{ first_name }} / {{ unsubscribe_url }} placeholders pass through
 *     untouched for the backend to fill in.
 */

export type EmailBlockType =
  | "heading"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer"

export type EmailBlock = {
  id: string
  type: EmailBlockType
  // heading / text / button
  text?: string
  // heading
  level?: 1 | 2
  // image / button
  url?: string
  // image
  alt?: string
  width?: number
  // button
  color?: string
  // spacer
  size?: number
}

let _seq = 0
export function newBlockId(): string {
  _seq += 1
  return `blk_${Date.now().toString(36)}_${_seq.toString(36)}`
}

export function makeBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case "heading":
      return { id: newBlockId(), type, text: "Your heading", level: 1 }
    case "text":
      return { id: newBlockId(), type, text: "Write your paragraph here. You can use *bold* and [a link](https://example.com)." }
    case "image":
      return { id: newBlockId(), type, url: "", alt: "", width: 560 }
    case "button":
      return { id: newBlockId(), type, text: "Click here", url: "https://", color: "" }
    case "divider":
      return { id: newBlockId(), type }
    case "spacer":
      return { id: newBlockId(), type, size: 24 }
    default:
      return { id: newBlockId(), type: "text", text: "" }
  }
}

export const BLOCK_TYPES: { type: EmailBlockType; label: string; icon: string }[] = [
  { type: "heading", label: "Heading", icon: "H" },
  { type: "text", label: "Text", icon: "¶" },
  { type: "image", label: "Image", icon: "🖼" },
  { type: "button", label: "Button", icon: "⬛" },
  { type: "divider", label: "Divider", icon: "—" },
  { type: "spacer", label: "Spacer", icon: "↕" },
]

// ═══════════════════════════════════════════
// COMPILER — blocks → responsive email HTML
// ═══════════════════════════════════════════

function escapeHtml(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/'/g, "&#39;")
}

/**
 * Inline markdown on an ALREADY-ESCAPED string. Order matters: links first
 * (so the URL isn't itself bolded), then bold, then newlines → <br>.
 * The url in [..](url) is re-escaped as an attribute defensively.
 */
function inlineMarkdown(escaped: string): string {
  let out = escaped
  // [label](url)
  out = out.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, url) => {
    const safeUrl = escapeAttr(url)
    return `<a href="${safeUrl}" style="color:${tokens.primary};text-decoration:underline" target="_blank" rel="noopener">${label}</a>`
  })
  // *bold*
  out = out.replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
  // newlines
  out = out.replace(/\n/g, "<br>")
  return out
}

function richText(raw: string): string {
  return inlineMarkdown(escapeHtml(raw))
}

const CONTAINER_WIDTH = 600

function compileBlock(b: EmailBlock, primary: string): string {
  switch (b.type) {
    case "heading": {
      const size = b.level === 2 ? "20px" : "26px"
      const mt = b.level === 2 ? "18px" : "8px"
      return `<tr><td style="padding:${mt} 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:${size};line-height:1.3;font-weight:700;color:#101828">${richText(b.text || "")}</td></tr>`
    }
    case "text":
      return `<tr><td style="padding:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.6;color:#344054">${richText(b.text || "")}</td></tr>`
    case "image": {
      if (!b.url) return ""
      const w = Math.min(Number(b.width) || CONTAINER_WIDTH, CONTAINER_WIDTH)
      return `<tr><td style="padding:6px 0 14px 0" align="center"><img src="${escapeAttr(b.url)}" alt="${escapeAttr(b.alt || "")}" width="${w}" style="display:block;width:100%;max-width:${w}px;height:auto;border:0;outline:none;text-decoration:none" /></td></tr>`
    }
    case "button": {
      const url = b.url || "#"
      const bg = (b.color && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(b.color)) ? b.color : primary
      return `<tr><td style="padding:8px 0 18px 0"><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="${escapeAttr(bg)}" style="border-radius:8px"><a href="${escapeAttr(url)}" target="_blank" rel="noopener" style="display:inline-block;padding:13px 26px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px">${escapeHtml(b.text || "Click here")}</a></td></tr></table></td></tr>`
    }
    case "divider":
      return `<tr><td style="padding:10px 0"><div style="border-top:1px solid #E4E7EC;font-size:0;line-height:0">&nbsp;</div></td></tr>`
    case "spacer": {
      const h = Math.max(4, Math.min(Number(b.size) || 24, 120))
      return `<tr><td style="font-size:0;line-height:0;height:${h}px">&nbsp;</td></tr>`
    }
    default:
      return ""
  }
}

/**
 * Wrap compiled rows in a 600px responsive, email-client-safe document.
 * `primary` is the brand button color (defaults to the design-system green).
 */
export function compileBlocksToHtml(blocks: EmailBlock[], primary?: string): string {
  const accent = (primary && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(primary)) ? primary : "#15803D"
  const rows = (blocks || []).map((b) => compileBlock(b, accent)).join("\n")
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
</head>
<body style="margin:0;padding:0;background:#F3F2EE;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F3F2EE">
<tr>
<td align="center" style="padding:24px 12px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${CONTAINER_WIDTH}" style="width:${CONTAINER_WIDTH}px;max-width:${CONTAINER_WIDTH}px;background:#ffffff;border-radius:10px">
<tr>
<td style="padding:32px 32px 24px 32px">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
${rows}
</table>
</td>
</tr>
</table>
</td>
</tr>
</table>
</body>
</html>`
}

// ═══════════════════════════════════════════
// VISUAL EDITOR
// ═══════════════════════════════════════════

export function BlockBuilder({
  blocks,
  onChange,
  accentColor,
}: {
  blocks: EmailBlock[]
  onChange: (next: EmailBlock[]) => void
  accentColor?: string
}) {
  const [addOpen, setAddOpen] = React.useState(false)

  const update = (id: string, patch: Partial<EmailBlock>) =>
    onChange(blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  const remove = (id: string) => onChange(blocks.filter((b) => b.id !== id))
  const move = (idx: number, dir: -1 | 1) => {
    const j = idx + dir
    if (j < 0 || j >= blocks.length) return
    const next = blocks.slice()
    const [it] = next.splice(idx, 1)
    next.splice(j, 0, it)
    onChange(next)
  }
  const add = (type: EmailBlockType) => {
    onChange([...blocks, makeBlock(type)])
    setAddOpen(false)
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {blocks.length === 0 && (
        <div
          style={{
            padding: "32px 20px",
            textAlign: "center",
            border: `1px dashed ${tokens.borderStrong}`,
            borderRadius: tokens.rMd,
            color: tokens.fgMuted,
            fontSize: "13px",
          }}
        >
          No blocks yet. Add your first block below, or start from a template.
        </div>
      )}

      {blocks.map((b, idx) => (
        <BlockCard
          key={b.id}
          block={b}
          first={idx === 0}
          last={idx === blocks.length - 1}
          accentColor={accentColor}
          onUpdate={(patch) => update(b.id, patch)}
          onRemove={() => remove(b.id)}
          onMoveUp={() => move(idx, -1)}
          onMoveDown={() => move(idx, 1)}
        />
      ))}

      <div style={{ position: "relative" }}>
        <button
          type="button"
          className="mkt-btn"
          onClick={() => setAddOpen((v) => !v)}
          style={{ width: "100%", borderStyle: "dashed", justifyContent: "center" }}
        >
          + Add block
        </button>
        {addOpen && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              zIndex: 30,
              background: tokens.surface,
              border: `1px solid ${tokens.borderStrong}`,
              borderRadius: tokens.rMd,
              boxShadow: tokens.shadowMd,
              padding: "6px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "4px",
            }}
          >
            {BLOCK_TYPES.map((t) => (
              <button
                key={t.type}
                type="button"
                onClick={() => add(t.type)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "8px 10px",
                  background: "transparent",
                  border: `1px solid ${tokens.borderSubtle}`,
                  borderRadius: tokens.rSm,
                  cursor: "pointer",
                  fontSize: "13px",
                  color: tokens.fg,
                  fontFamily: "inherit",
                  textAlign: "left",
                }}
              >
                <span style={{ width: "18px", textAlign: "center", color: tokens.fgSecondary }}>{t.icon}</span>
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BlockCard({
  block,
  first,
  last,
  accentColor,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  block: EmailBlock
  first: boolean
  last: boolean
  accentColor?: string
  onUpdate: (patch: Partial<EmailBlock>) => void
  onRemove: () => void
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const meta = BLOCK_TYPES.find((t) => t.type === block.type)
  return (
    <div
      style={{
        border: `1px solid ${tokens.borderStrong}`,
        borderRadius: tokens.rMd,
        background: tokens.surface,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px 8px 12px",
          background: tokens.borderSubtle,
          borderBottom: `1px solid ${tokens.border}`,
        }}
      >
        <span style={{ fontSize: "12px", fontWeight: 600, color: tokens.fgSecondary, display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ color: tokens.fgMuted }}>{meta?.icon}</span>
          {meta?.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          <IconBtn label="Move up" disabled={first} onClick={onMoveUp}>↑</IconBtn>
          <IconBtn label="Move down" disabled={last} onClick={onMoveDown}>↓</IconBtn>
          <IconBtn label="Delete block" danger onClick={onRemove}>×</IconBtn>
        </div>
      </div>
      <div style={{ padding: "12px" }}>
        <BlockFields block={block} accentColor={accentColor} onUpdate={onUpdate} />
      </div>
    </div>
  )
}

function IconBtn({
  children,
  onClick,
  disabled,
  danger,
  label,
}: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      style={{
        width: "26px",
        height: "26px",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        border: "none",
        borderRadius: tokens.rSm,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.3 : 1,
        color: danger ? tokens.dangerFg : tokens.fgSecondary,
        fontSize: "16px",
        lineHeight: 1,
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  )
}

function BlockFields({
  block,
  accentColor,
  onUpdate,
}: {
  block: EmailBlock
  accentColor?: string
  onUpdate: (patch: Partial<EmailBlock>) => void
}) {
  const taStyle: React.CSSProperties = {
    width: "100%",
    minHeight: "70px",
    padding: "9px 11px",
    border: `1px solid ${tokens.borderStrong}`,
    borderRadius: tokens.rMd,
    fontSize: "14px",
    lineHeight: 1.5,
    fontFamily: "inherit",
    color: tokens.fg,
    resize: "vertical",
    boxSizing: "border-box",
  }

  switch (block.type) {
    case "heading":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input
            className="mkt-input"
            value={block.text || ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Heading text"
          />
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: tokens.fgSecondary }}>Size</span>
            <SegBtn active={(block.level || 1) === 1} onClick={() => onUpdate({ level: 1 })}>Large</SegBtn>
            <SegBtn active={block.level === 2} onClick={() => onUpdate({ level: 2 })}>Small</SegBtn>
          </div>
        </div>
      )
    case "text":
      return (
        <div>
          <textarea
            value={block.text || ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Write your text…"
            style={taStyle}
          />
          <div style={{ fontSize: "11px", color: tokens.fgMuted, marginTop: "5px" }}>
            Use <code>*bold*</code>, <code>[label](url)</code> for links, and Enter for new lines.
          </div>
        </div>
      )
    case "image":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input
            className="mkt-input"
            value={block.url || ""}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="Image URL (https://…)"
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: "8px" }}>
            <input
              className="mkt-input"
              value={block.alt || ""}
              onChange={(e) => onUpdate({ alt: e.target.value })}
              placeholder="Alt text"
            />
            <input
              className="mkt-input"
              type="number"
              min={40}
              max={600}
              value={block.width ?? 560}
              onChange={(e) => onUpdate({ width: Number(e.target.value) || 560 })}
              placeholder="Width"
            />
          </div>
          <div style={{ fontSize: "11px", color: tokens.fgMuted }}>Max width 600px. Use a publicly hosted image URL.</div>
        </div>
      )
    case "button":
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <input
            className="mkt-input"
            value={block.text || ""}
            onChange={(e) => onUpdate({ text: e.target.value })}
            placeholder="Button label"
          />
          <input
            className="mkt-input"
            value={block.url || ""}
            onChange={(e) => onUpdate({ url: e.target.value })}
            placeholder="Button URL (https://…)"
          />
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "12px", color: tokens.fgSecondary }}>Color</span>
            <input
              type="color"
              value={block.color || accentColor || "#15803D"}
              onChange={(e) => onUpdate({ color: e.target.value })}
              style={{ width: "36px", height: "30px", padding: 0, border: `1px solid ${tokens.borderStrong}`, borderRadius: tokens.rSm, cursor: "pointer", background: "none" }}
              title="Button color"
            />
            <SegBtn active={!block.color} onClick={() => onUpdate({ color: "" })}>Use brand color</SegBtn>
          </div>
        </div>
      )
    case "spacer":
      return (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "12px", color: tokens.fgSecondary, minWidth: "70px" }}>Height {block.size ?? 24}px</span>
          <input
            type="range"
            min={4}
            max={120}
            step={4}
            value={block.size ?? 24}
            onChange={(e) => onUpdate({ size: Number(e.target.value) })}
            style={{ flex: 1 }}
          />
        </div>
      )
    case "divider":
      return <div style={{ fontSize: "12px", color: tokens.fgMuted }}>A thin horizontal line.</div>
    default:
      return null
  }
}

function SegBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "5px 11px",
        fontSize: "12px",
        fontWeight: 500,
        border: `1px solid ${active ? tokens.primary : tokens.borderStrong}`,
        background: active ? tokens.primarySoft : tokens.surface,
        color: active ? tokens.primary : tokens.fgSecondary,
        borderRadius: tokens.rSm,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {children}
    </button>
  )
}
