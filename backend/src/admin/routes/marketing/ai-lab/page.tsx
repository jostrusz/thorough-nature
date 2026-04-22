// @ts-nocheck
import React, { useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { useQuery } from "@tanstack/react-query"
import { sdk } from "../../../lib/sdk"
import { MarketingShell, tokens } from "../../../components/marketing/shared"

/**
 * AI Email Lab — manual sandbox for testing AI-generated nurture emails.
 *
 * Fill in: brand, persona (first name + locale), the 4 quiz answers, day
 * template, and (optionally) model. Click Generate. Hits POST
 * /admin/marketing/email/ai-preview which calls Sonnet/Opus and returns
 * the rendered HTML + the structured blocks Sonnet produced.
 *
 * Result panel shows:
 *   • subject + preheader
 *   • model used + generated_at + ms latency
 *   • iframe with the actual email HTML
 *   • collapsible JSON of the blocks Sonnet returned
 *
 * Nothing is written to the DB. Nothing is sent. Pure sandbox.
 */

// ── Quiz option presets matching the popup ────────────────────────────
const AREAS = [
  { v: "relaties",  l: "💔 Vztahy" },
  { v: "verleden",  l: "🕰 Minulost" },
  { v: "gedachten", l: "🌀 Myšlenky" },
  { v: "emoties",   l: "🌊 Emoce" },
  { v: "zelfbeeld", l: "🪞 Pohled na sebe" },
  { v: "toekomst",  l: "🌫 Strach z budoucnosti" },
]

const TARGETS_PER_AREA: Record<string, { v: string; l: string }[]> = {
  relaties: [
    { v: "partner", l: "💔 Partner / bývalý" },
    { v: "parent",  l: "👵 Máma / táta" },
    { v: "sibling", l: "👫 Sourozenec" },
    { v: "friend",  l: "🤝 Přítel" },
    { v: "boss",    l: "💼 Šéf / kolega" },
    { v: "self",    l: "🪞 Já sám/a" },
  ],
  verleden: [
    { v: "childhood", l: "🧒 Z dětství" },
    { v: "breakup",   l: "💔 Rozchod" },
    { v: "event",     l: "⚡ Konkrétní událost" },
    { v: "did",       l: "🙈 Něco co jsem udělal/a" },
    { v: "happened",  l: "💧 Co mi někdo udělal" },
    { v: "loss",      l: "🕯 Ztráta" },
  ],
  gedachten: [
    { v: "work",     l: "💼 Práce" },
    { v: "money",    l: "💰 Peníze" },
    { v: "relation", l: "❤️ Vztah" },
    { v: "health",   l: "🫀 Zdraví" },
    { v: "future",   l: "🔮 Budoucnost" },
    { v: "past",     l: "🕰 Minulost" },
  ],
  emoties: [
    { v: "anger",   l: "😤 Hněv" },
    { v: "sadness", l: "😢 Smutek" },
    { v: "shame",   l: "😔 Stud" },
    { v: "guilt",   l: "🔒 Vina" },
    { v: "anxiety", l: "😰 Úzkost" },
    { v: "empty",   l: "💀 Prázdnota" },
  ],
  zelfbeeld: [
    { v: "body",     l: "🪞 Tělo" },
    { v: "ability",  l: "🧠 Schopnosti" },
    { v: "worth",    l: "💔 Hodnota" },
    { v: "voice",    l: "💬 Jak mluvím" },
    { v: "weakness", l: "🥀 Slabost" },
    { v: "real",     l: "🎭 Kdo jsem" },
  ],
  toekomst: [
    { v: "alone",    l: "🪑 Být sám/a" },
    { v: "money",    l: "💸 Peníze" },
    { v: "latetime", l: "⏳ Že je pozdě" },
    { v: "fail",     l: "🎯 Že nedokážu" },
    { v: "death",    l: "🌑 Smrt" },
    { v: "stuck",    l: "🌊 Že se to nezmění" },
  ],
}

const TRIGGERS = [
  { v: "3am",     l: "🌙 Ve 3 ráno" },
  { v: "morning", l: "☕ Po probuzení" },
  { v: "alone",   l: "🚗 Když jsem sám/a" },
  { v: "people",  l: "👥 S lidmi (skrývám to)" },
  { v: "trigger", l: "⚡ Když mi to připomene" },
  { v: "always",  l: "🔄 Pořád" },
]

const SENTENCES = [
  { v: "Nejsem dost.",                                 l: "„Nejsem dost." },
  { v: "Už je pozdě.",                                 l: "„Už je pozdě." },
  { v: "Je to moje chyba.",                            l: "„Je to moje chyba." },
  { v: "Kdybych to pustil/a, ztratím všechno.",        l: "„Kdybych to pustil/a, ztratím všechno." },
  { v: "Prostě takový/á jsem.",                        l: "„Prostě takový/á jsem." },
  { v: "Nikdo mě nepochopí.",                          l: "„Nikdo mě nepochopí." },
]

const MODELS = [
  { v: "",                              l: "Default per day (Sonnet for D1/D2, Opus for D3)" },
  { v: "claude-sonnet-4-6",             l: "Sonnet 4.6 (cheaper)" },
  { v: "claude-opus-4-7",               l: "Opus 4.7 (richer)" },
  { v: "claude-haiku-4-5-20251001",     l: "Haiku 4.5 (fastest)" },
]

// ── Component ─────────────────────────────────────────────────────────
function AiEmailLabPage() {
  const { data: brandsResp } = useQuery({
    queryKey: ["mkt-brands"],
    queryFn: () => sdk.client.fetch<{ brands: any[] }>("/admin/marketing/brands", { method: "GET" }),
  })
  const brands = brandsResp?.brands || []

  const [brandSlug, setBrandSlug] = useState("loslatenboek")
  const [firstName, setFirstName] = useState("Anna")
  const [locale, setLocale] = useState("nl")
  const [area, setArea] = useState("relaties")
  const [target, setTarget] = useState("parent")
  const [trigger, setTrigger] = useState("3am")
  const [sentence, setSentence] = useState("Měla jsem být lepší dcera.")
  const [day, setDay] = useState<"day1" | "day2" | "day3">("day1")
  const [model, setModel] = useState("")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [latencyMs, setLatencyMs] = useState<number | null>(null)
  const [showJson, setShowJson] = useState(false)

  const targetOptions = TARGETS_PER_AREA[area] || TARGETS_PER_AREA.relaties

  const generate = async () => {
    setLoading(true)
    setError(null)
    setResult(null)
    setLatencyMs(null)
    const start = Date.now()
    try {
      const resp = await sdk.client.fetch<any>("/admin/marketing/email/ai-preview", {
        method: "POST",
        body: {
          brand_slug: brandSlug,
          first_name: firstName,
          email: `${firstName.toLowerCase()}@preview.local`,
          locale,
          properties: {
            quiz_area: area,
            quiz_target: target,
            quiz_trigger: trigger,
            quiz_own_sentence: sentence,
          },
          day_template: day,
          model: model || undefined,
        },
      })
      setResult(resp)
      setLatencyMs(Date.now() - start)
    } catch (e: any) {
      setError(e?.message || "Generation failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <MarketingShell title="AI Email Lab" subtitle="Test AI-generated nurture emails on any persona — no DB writes, no sends.">
      <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 24 }}>

        {/* ── LEFT: input form ──────────────────────────────────── */}
        <div className="mkt-card" style={{ padding: 22, alignSelf: "start" }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: tokens.fg }}>
            Persona &amp; quiz answers
          </h3>

          <Field label="Brand">
            <select value={brandSlug} onChange={(e) => setBrandSlug(e.target.value)} style={selectStyle}>
              {brands.length === 0 && <option value="loslatenboek">loslatenboek</option>}
              {brands.map((b) => (
                <option key={b.id} value={b.slug}>{b.display_name || b.slug}</option>
              ))}
            </select>
          </Field>

          <Field label="First name">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Locale">
            <select value={locale} onChange={(e) => setLocale(e.target.value)} style={selectStyle}>
              {["nl", "cs", "de", "pl", "sv", "en"].map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </Field>

          <Divider label="Quiz path" />

          <Field label="K1 — Area">
            <select value={area} onChange={(e) => { setArea(e.target.value); setTarget(TARGETS_PER_AREA[e.target.value]?.[0]?.v || "") }} style={selectStyle}>
              {AREAS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>

          <Field label="K2 — Specific target">
            <select value={target} onChange={(e) => setTarget(e.target.value)} style={selectStyle}>
              {targetOptions.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>

          <Field label="K3 — Trigger moment">
            <select value={trigger} onChange={(e) => setTrigger(e.target.value)} style={selectStyle}>
              {TRIGGERS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
            </select>
          </Field>

          <Field label="K4 — Their own sentence">
            <select value={sentence} onChange={(e) => setSentence(e.target.value)} style={selectStyle}>
              {SENTENCES.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
              <option value="__custom__">✍️ Custom (write below)</option>
            </select>
            {!SENTENCES.find((s) => s.v === sentence) && sentence !== "__custom__" && (
              <input
                value={sentence}
                onChange={(e) => setSentence(e.target.value)}
                placeholder="Vlastní věta..."
                style={{ ...inputStyle, marginTop: 6 }}
              />
            )}
            {sentence === "__custom__" && (
              <input
                autoFocus
                onChange={(e) => setSentence(e.target.value)}
                placeholder="Vlastní věta, kterou si čtenář říká..."
                style={{ ...inputStyle, marginTop: 6 }}
              />
            )}
          </Field>

          <Divider label="Generation" />

          <Field label="Day template">
            <select value={day} onChange={(e) => setDay(e.target.value as any)} style={selectStyle}>
              <option value="day1">Day 1 — validation + reframe (no sell)</option>
              <option value="day2">Day 2 — story + 90s tool (no sell)</option>
              <option value="day3">Day 3 — soft book bridge (with CTA)</option>
            </select>
          </Field>

          <Field label="Model">
            <select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle}>
              {MODELS.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select>
          </Field>

          <button
            onClick={generate}
            disabled={loading || !brandSlug || !firstName}
            style={{
              width: "100%", marginTop: 18, padding: "12px 16px",
              background: loading ? "#666" : tokens.primary, color: "#fff",
              border: "none", borderRadius: 6, fontSize: 14, fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Generating… (5–15s)" : "Generate email →"}
          </button>

          {error && (
            <div style={{ marginTop: 12, padding: 12, background: "#fee", border: "1px solid #fcc", borderRadius: 6, fontSize: 13, color: "#900" }}>
              ❌ {error}
            </div>
          )}
        </div>

        {/* ── RIGHT: result panel ───────────────────────────────── */}
        <div>
          {!result && !loading && (
            <div className="mkt-card" style={{ padding: 60, textAlign: "center", color: tokens.fgSecondary }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>✨</div>
              <div style={{ fontSize: 15 }}>Vyplň formulář vlevo a klikni <strong>Generate</strong>.</div>
              <div style={{ fontSize: 13, marginTop: 8 }}>Sonnet vygeneruje email pro tu personu — uvidíš ho tady.</div>
            </div>
          )}

          {loading && (
            <div className="mkt-card" style={{ padding: 60, textAlign: "center", color: tokens.fgSecondary }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
              <div style={{ fontSize: 15 }}>AI píše email pro <strong>{firstName}</strong>…</div>
            </div>
          )}

          {result && (
            <>
              <div className="mkt-card" style={{ padding: 18, marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start", flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <div style={{ fontSize: 11, color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Subject</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: tokens.fg, marginBottom: 10 }}>{result.subject}</div>
                    <div style={{ fontSize: 11, color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>Preheader</div>
                    <div style={{ fontSize: 14, color: tokens.fgSecondary, fontStyle: "italic" }}>{result.preheader}</div>
                  </div>
                  <div style={{ textAlign: "right", fontSize: 12, color: tokens.fgSecondary }}>
                    <div>Model: <strong>{result.model_used}</strong></div>
                    <div>Latency: <strong>{latencyMs ? `${(latencyMs / 1000).toFixed(1)}s` : "–"}</strong></div>
                    <div>Blocks: <strong>{result.blocks?.length || 0}</strong></div>
                  </div>
                </div>
              </div>

              <div className="mkt-card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", borderBottom: `1px solid ${tokens.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: 13 }}>📧 Rendered email preview</strong>
                  <span style={{ fontSize: 11, color: tokens.fgSecondary }}>iframe — exactly as Gmail/Outlook will render</span>
                </div>
                <iframe
                  title="AI email preview"
                  srcDoc={result.html}
                  style={{ width: "100%", height: 720, border: "none", background: "#faf5f8" }}
                />
              </div>

              <div className="mkt-card" style={{ padding: 14, marginTop: 16 }}>
                <button
                  onClick={() => setShowJson((v) => !v)}
                  style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: tokens.primary }}
                >
                  {showJson ? "▾" : "▸"} Sonnet's raw block JSON
                </button>
                {showJson && (
                  <pre style={{ marginTop: 12, padding: 14, background: "#0d1117", color: "#c9d1d9", fontSize: 12, fontFamily: "ui-monospace,monospace", borderRadius: 6, overflowX: "auto", maxHeight: 460 }}>
{JSON.stringify(result.blocks, null, 2)}
                  </pre>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </MarketingShell>
  )
}

// ── Tiny atomic style helpers ────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "8px 10px", fontSize: 13, border: `1px solid ${tokens.border}`, borderRadius: 6, background: "#fff",
}
const selectStyle: React.CSSProperties = { ...inputStyle, height: 34 }

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: tokens.fgSecondary, display: "block", marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0 10px 0" }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: tokens.fgSecondary, textTransform: "uppercase", letterSpacing: 0.5 }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: tokens.border }} />
    </div>
  )
}

export const config = defineRouteConfig({
  label: "AI Email Lab",
})

export default AiEmailLabPage
