// @ts-nocheck
import React, { useMemo, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

/* ─────────────────────────────────────────────────────────────
 * Knihovna reklam — databáze FB kreativ + živý výkon z Meta API
 * ──────────────────────────────────────────────────────────── */

const PROJECTS: Record<string, { flag: string; lang: string }> = {
  loslatenboek: { flag: "🇳🇱", lang: "NL" }, "het-leven": { flag: "🇳🇱", lang: "NL" },
  dehondenbijbel: { flag: "🇳🇱", lang: "NL" }, "lass-los": { flag: "🇩🇪", lang: "DE" },
  "odpusc-ksiazka": { flag: "🇵🇱", lang: "PL" }, "zycie-zaslugy": { flag: "🇵🇱", lang: "PL" },
  "biblia-kotow": { flag: "🇵🇱", lang: "PL" }, "odpust-knizka": { flag: "🇨🇿", lang: "CZ" },
  "zivot-zaslugy": { flag: "🇨🇿", lang: "CZ" }, "psi-superzivot": { flag: "🇨🇿", lang: "CZ" },
  "kocici-bible": { flag: "🇨🇿", lang: "CZ" }, "pusti-to-sk": { flag: "🇸🇰", lang: "SK" },
  "slapp-taget": { flag: "🇸🇪", lang: "SE" }, "slipp-taket": { flag: "🇳🇴", lang: "NO" },
  "engedd-el": { flag: "🇭🇺", lang: "HU" }, "lache-livre": { flag: "🇫🇷", lang: "FR" },
}
const RANGES = [["3d", "3 dny"], ["7d", "7 dní"], ["14d", "14 dní"], ["30d", "30 dní"],
  ["90d", "3 měs."], ["180d", "6 měs."], ["365d", "1 rok"]]

const S = {
  card: { background: "var(--bg-base, #fff)", border: "1px solid var(--border-base, #e5e7eb)", borderRadius: 10 } as any,
  chip: { fontSize: 11, padding: "1px 8px", borderRadius: 999, background: "var(--bg-subtle, #f3f4f6)", whiteSpace: "nowrap" } as any,
  btn: { fontSize: 13, padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border-base, #d1d5db)", background: "var(--bg-base, #fff)", cursor: "pointer" } as any,
  btnPri: { fontSize: 13, padding: "6px 12px", borderRadius: 8, border: "1px solid #7c3aed", background: "#7c3aed", color: "#fff", cursor: "pointer", fontWeight: 600 } as any,
  input: { fontSize: 13, padding: "7px 10px", borderRadius: 8, border: "1px solid var(--border-base, #d1d5db)", background: "var(--bg-base, #fff)" } as any,
  mono: { fontFamily: "ui-monospace, Menlo, monospace", fontVariantNumeric: "tabular-nums" } as any,
}

const fmtEur = (n: number) => (n || 0).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " €"

/* ── Knihovna tab ── */
function LibraryTab() {
  const qc = useQueryClient()
  const [q, setQ] = useState(""); const [project, setProject] = useState("")
  const [tag, setTag] = useState(""); const [sort, setSort] = useState("date")
  const [checked, setChecked] = useState<Record<string, string[]>>({})
  const [open, setOpen] = useState<Record<string, boolean>>({})
  const [modal, setModal] = useState<any>(null) // { creative, target, preview }

  const { data, isLoading } = useQuery({
    queryKey: ["ads-lib", q, project, tag, sort],
    queryFn: () => sdk.client.fetch(
      `/admin/ads-library/creatives?q=${encodeURIComponent(q)}&project=${project}&tag=${tag}&sort=${sort}`,
      { method: "GET" }
    ),
  })
  const creatives = data?.creatives || []

  const translate = useMutation({
    mutationFn: async ({ id, body }: any) =>
      sdk.client.fetch(`/admin/ads-library/creatives/${id}/translate`, { method: "POST", body }),
  })

  const tick = (id: string, key: string) => setChecked((c) => {
    const arr = c[id] ? [...c[id]] : []
    const i = arr.indexOf(key); i >= 0 ? arr.splice(i, 1) : arr.push(key)
    return { ...c, [id]: arr }
  })

  const runPreview = async () => {
    const sel = checked[modal.creative.id] || []
    const body = {
      target_project: modal.target,
      primary_indexes: sel.filter((k) => k[0] === "P").map((k) => +k.slice(1)),
      headline_indexes: sel.filter((k) => k[0] === "H").map((k) => +k.slice(1)),
    }
    const res = await translate.mutateAsync({ id: modal.creative.id, body })
    setModal((m: any) => ({ ...m, preview: res.translation }))
  }
  const savePreview = async () => {
    await translate.mutateAsync({
      id: modal.creative.id,
      body: { target_project: modal.target, save: true, edited: modal.preview },
    })
    setModal(null); setChecked({})
    qc.invalidateQueries({ queryKey: ["ads-lib"] })
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <input style={{ ...S.input, flex: 1, minWidth: 200 }} placeholder="🔍 Hledat v textech…"
          value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={S.input} value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">Projekt: všechny</option>
          {Object.entries(PROJECTS).map(([k, v]) => <option key={k} value={k}>{v.flag} {k}</option>)}
        </select>
        <select style={S.input} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">Štítek: vše</option><option value="winner">🏆 winner</option>
          <option value="test">🧪 testuje se</option><option value="evergreen">🌲 evergreen</option>
        </select>
        <select style={S.input} value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="date">Řadit: datum</option><option value="roas">Řadit: ROAS</option>
          <option value="sales">Řadit: prodeje</option><option value="cpa">Řadit: CPA</option>
        </select>
        <span style={{ fontSize: 12, color: "var(--fg-muted, #6b7280)", alignSelf: "center", marginLeft: "auto" }}>
          {data?.count ?? "…"} reklam
        </span>
      </div>

      {isLoading && <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>Načítám knihovnu…</div>}
      {!isLoading && !creatives.length && (
        <div style={{ ...S.card, padding: 30, textAlign: "center", color: "#6b7280" }}>
          Knihovna je prázdná — přidej vítěze ze záložky <b>🏆 Výkon</b>.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(420px, 1fr))", gap: 12 }}>
        {creatives.map((a: any) => {
          const sel = checked[a.id] || []
          const isOpen = open[a.id]
          const P = a.primary_texts || [], H = a.headlines || []
          const rows = [
            ...P.map((t: string, i: number) => ({ key: `P${i}`, label: `P${i + 1}`, text: t })),
            ...H.map((t: string, i: number) => ({ key: `H${i}`, label: `H${i + 1}`, text: t })),
          ]
          const visible = isOpen ? rows : rows.slice(0, 3)
          return (
            <div key={a.id} style={{ ...S.card, overflow: "hidden", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 12, padding: 12, flex: 1 }}>
                <div style={{ flexShrink: 0, width: 96, textAlign: "center" }}>
                  {a.image_1x1_url || a.video_thumb_url ? (
                    <img src={a.image_1x1_url || a.video_thumb_url} alt={a.name}
                      style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                  ) : (
                    <div style={{ width: 96, height: 96, borderRadius: 8, background: "#f3f4f6",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>
                      {a.media_type === "video" ? "🎬" : "🖼️"}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>{a.media_type}</div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <b style={{ fontSize: 13.5 }}>{a.name}</b>
                    <span style={S.chip}>{PROJECTS[a.project_id]?.flag || "🌐"} {a.language}</span>
                    <span style={S.chip}>{a.project_id}</span>
                    {a.tag === "winner" && <span style={{ ...S.chip, background: "#dcfce7", color: "#15803d", fontWeight: 600 }}>🏆 winner</span>}
                    {a.source === "translation" && <span style={{ ...S.chip, background: "#ede9fe", color: "#7c3aed" }}>🌍 překlad</span>}
                  </div>
                  {a.perf && (
                    <div style={{ ...S.mono, fontSize: 11, color: "#6b7280", margin: "4px 0 6px" }}>
                      ROAS <b style={{ color: "#111827" }}>{(a.perf.roas || 0).toFixed(1)}×</b> · {a.perf.sales || 0} prodejů
                      · CPA {(a.perf.cpa || 0).toFixed(1)} € · CTR {(a.perf.ctr || 0).toFixed(2)} %
                    </div>
                  )}
                  <div style={{ fontSize: 12.5, marginTop: 4 }}>
                    {visible.map((r) => (
                      <label key={r.key} style={{ display: "flex", gap: 7, padding: "2px 0", cursor: "pointer", alignItems: "flex-start" }}>
                        <input type="checkbox" checked={sel.includes(r.key)} onChange={() => tick(a.id, r.key)} style={{ marginTop: 3 }} />
                        <span style={{ ...S.mono, fontSize: 10, color: "#9ca3af", width: 26, flexShrink: 0, paddingTop: 2 }}>{r.label}</span>
                        <span style={isOpen ? {} : { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.text}</span>
                      </label>
                    ))}
                    {rows.length > 3 && (
                      <button style={{ ...S.btn, border: "none", color: "#7c3aed", padding: "2px 0", fontSize: 12 }}
                        onClick={() => setOpen((o) => ({ ...o, [a.id]: !isOpen }))}>
                        {isOpen ? "Sbalit ▴" : `＋ ${rows.length - 3} dalších textů ▾`}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, padding: "8px 12px", borderTop: "1px solid #e5e7eb", background: "var(--bg-subtle, #f9fafb)" }}>
                <button style={sel.length ? S.btnPri : { ...S.btn, opacity: 0.5, cursor: "not-allowed" }}
                  disabled={!sel.length}
                  onClick={() => setModal({ creative: a, target: "lache-livre", preview: null })}>
                  🌍 Přeložit vybrané ({sel.length})
                </button>
                <span style={{ marginLeft: "auto", fontSize: 11, color: "#9ca3af", alignSelf: "center" }}>
                  {new Date(a.created_at).toLocaleDateString("cs-CZ")}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60,
          display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "6vh 16px" }}
          onClick={(e) => e.target === e.currentTarget && setModal(null)}>
          <div style={{ ...S.card, maxWidth: 620, width: "100%", maxHeight: "85vh", overflow: "auto", background: "#fff" }}>
            <div style={{ padding: "13px 18px", borderBottom: "1px solid #e5e7eb", display: "flex" }}>
              <b>🌍 Přeložit — {modal.creative.name}</b>
              <button style={{ ...S.btn, border: "none", marginLeft: "auto" }} onClick={() => setModal(null)}>✕</button>
            </div>
            <div style={{ padding: "14px 18px" }}>
              <label style={{ fontSize: 11, color: "#6b7280", display: "block", marginBottom: 5 }}>CÍLOVÝ PROJEKT</label>
              <select style={{ ...S.input, width: "100%" }} value={modal.target}
                onChange={(e) => setModal((m: any) => ({ ...m, target: e.target.value, preview: null }))}>
                {Object.entries(PROJECTS).filter(([k]) => k !== modal.creative.project_id)
                  .map(([k, v]) => <option key={k} value={k}>{v.flag} {k} — {v.lang}</option>)}
              </select>
              <div style={{ fontSize: 11, color: "#6b7280", margin: "8px 0 14px" }}>
                AI adaptuje texty s kontextem cílové knihy (tón, tykání, fakta) — ne doslovný překlad.
              </div>
              {modal.preview && (
                <div style={{ border: "1px solid #7c3aed", borderRadius: 8, padding: 12, background: "#faf5ff" }}>
                  {(modal.preview.primaries || []).map((p: string, i: number) => (
                    <div key={`p${i}`} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>PRIMARY {i + 1}</div>
                      <textarea style={{ ...S.input, width: "100%", minHeight: 70 }} value={p}
                        onChange={(e) => setModal((m: any) => {
                          const pr = { ...m.preview }; pr.primaries = [...pr.primaries]; pr.primaries[i] = e.target.value
                          return { ...m, preview: pr }
                        })} />
                    </div>
                  ))}
                  {(modal.preview.headlines || []).map((h: string, i: number) => (
                    <div key={`h${i}`} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, color: "#6b7280", marginBottom: 3 }}>HEADLINE {i + 1}</div>
                      <input style={{ ...S.input, width: "100%" }} value={h}
                        onChange={(e) => setModal((m: any) => {
                          const pr = { ...m.preview }; pr.headlines = [...pr.headlines]; pr.headlines[i] = e.target.value
                          return { ...m, preview: pr }
                        })} />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={{ padding: "12px 18px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={S.btn} onClick={() => setModal(null)}>Zavřít</button>
              {!modal.preview ? (
                <button style={S.btnPri} disabled={translate.isPending} onClick={runPreview}>
                  {translate.isPending ? "Překládám…" : "Přeložit →"}
                </button>
              ) : (
                <button style={S.btnPri} disabled={translate.isPending} onClick={savePreview}>
                  {translate.isPending ? "Ukládám…" : "💾 Uložit do knihovny"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Výkon tab ── */
function PerformanceTab() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])
  const [range, setRange] = useState("7d")
  const [sort, setSort] = useState("roas")
  const [importing, setImporting] = useState<string | null>(null)
  const [importFor, setImportFor] = useState<any>(null) // row awaiting project pick

  const accountsQ = useQuery({
    queryKey: ["ads-accounts"],
    queryFn: () => sdk.client.fetch("/admin/ads-library/accounts", { method: "GET" }),
  })
  const accounts = accountsQ.data?.accounts || []

  const perfQ = useQuery({
    queryKey: ["ads-perf", selected.join(","), range, sort],
    enabled: selected.length > 0,
    queryFn: () => sdk.client.fetch(
      `/admin/ads-library/performance?accounts=${selected.join(",")}&range=${range}&sort=${sort}&limit=40`,
      { method: "GET" }
    ),
  })

  const doImport = async (row: any, projectId: string) => {
    setImporting(row.ad_id); setImportFor(null)
    try {
      await sdk.client.fetch("/admin/ads-library/import", {
        method: "POST",
        body: {
          meta_ad_id: row.ad_id, account_id: row.account_id,
          project_id: projectId, language: PROJECTS[projectId]?.lang || "NL", range,
        },
      })
      qc.invalidateQueries({ queryKey: ["ads-perf"] })
      qc.invalidateQueries({ queryKey: ["ads-lib"] })
    } finally { setImporting(null) }
  }

  const toggleAcc = (id: string) => setSelected((s) =>
    s.includes(id) ? s.filter((x) => x !== id) : [...s, id])

  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {accountsQ.isLoading && <span style={{ fontSize: 13, color: "#6b7280" }}>Načítám účty z Meta API…</span>}
        {accountsQ.error && <span style={{ fontSize: 13, color: "#dc2626" }}>Meta API nedostupné: {String(accountsQ.error?.message || "")}</span>}
        {accounts.map((a: any) => (
          <button key={a.id} onClick={() => toggleAcc(a.id)}
            style={selected.includes(a.id)
              ? { ...S.btn, borderColor: "#7c3aed", background: "#ede9fe", fontWeight: 600 }
              : S.btn}>
            {selected.includes(a.id) ? "✓ " : ""}{a.name}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        {RANGES.map(([k, label]) => (
          <button key={k} onClick={() => setRange(k)}
            style={range === k ? { ...S.btn, background: "#111827", color: "#fff", borderColor: "#111827" } : S.btn}>
            {label}
          </button>
        ))}
        <span style={{ width: 14 }} />
        {[["roas", "ROAS"], ["sales", "Prodeje"], ["ctr", "CTR"], ["spend", "Spend"]].map(([k, label]) => (
          <button key={k} onClick={() => setSort(k)}
            style={sort === k ? { ...S.btn, borderColor: "#7c3aed", color: "#7c3aed", fontWeight: 600 } : S.btn}>
            ↓ {label}
          </button>
        ))}
      </div>

      {!selected.length && (
        <div style={{ ...S.card, padding: 30, textAlign: "center", color: "#6b7280" }}>
          ☝️ Vyber nahoře jeden nebo více reklamních účtů.
        </div>
      )}
      {perfQ.isFetching && <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Tahám živá data z Meta API…</div>}
      {perfQ.error && <div style={{ ...S.card, padding: 20, color: "#dc2626" }}>Chyba: {String(perfQ.error?.message || "")}</div>}

      {perfQ.data?.rows?.length > 0 && (
        <div style={{ ...S.card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead><tr style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280" }}>
                <th style={{ textAlign: "left", padding: "8px 12px" }}>Reklama</th>
                <th style={{ textAlign: "left", padding: "8px 8px" }}>Účet</th>
                <th style={{ textAlign: "right", padding: "8px 8px" }}>Spend</th>
                <th style={{ textAlign: "right", padding: "8px 8px" }}>Prodeje</th>
                <th style={{ textAlign: "right", padding: "8px 8px" }}>CPA</th>
                <th style={{ textAlign: "right", padding: "8px 8px" }}>ROAS</th>
                <th style={{ textAlign: "right", padding: "8px 8px" }}>CTR</th>
                <th style={{ padding: "8px 12px" }} />
              </tr></thead>
              <tbody>
                {perfQ.data.rows.map((r: any) => (
                  <tr key={r.ad_id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "7px 12px", maxWidth: 340 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                        {r.thumb
                          ? <img src={r.thumb} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />
                          : <span style={{ width: 34, height: 34, borderRadius: 6, background: "#f3f4f6", display: "inline-flex",
                              alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🖼️</span>}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>{r.ad_name}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.campaign_name}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "7px 8px", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>{r.account_name}</td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "7px 8px" }}>{fmtEur(r.spend)}</td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "7px 8px" }}>{r.sales}</td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "7px 8px" }}>{r.cpa ? r.cpa.toFixed(1) + " €" : "—"}</td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "7px 8px", fontWeight: 700,
                      color: r.roas >= 2 ? "#15803d" : r.roas >= 1.3 ? "#b45309" : "#b91c1c" }}>
                      {r.roas ? r.roas.toFixed(2) + "×" : "—"}
                    </td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "7px 8px" }}>{r.ctr ? r.ctr.toFixed(2) + " %" : "—"}</td>
                    <td style={{ padding: "7px 12px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {r.in_library
                        ? <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>v knihovně ✓</span>
                        : importFor?.ad_id === r.ad_id
                          ? <select autoFocus style={{ ...S.input, fontSize: 12 }} defaultValue=""
                              onChange={(e) => e.target.value && doImport(r, e.target.value)}
                              onBlur={() => setImportFor(null)}>
                              <option value="" disabled>Projekt…</option>
                              {Object.entries(PROJECTS).map(([k, v]) => <option key={k} value={k}>{v.flag} {k}</option>)}
                            </select>
                          : <button style={S.btn} disabled={importing === r.ad_id} onClick={() => setImportFor(r)}>
                              {importing === r.ad_id ? "Importuji…" : "＋ do knihovny"}
                            </button>}
                    </td>
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

/* ── Page shell ── */
const AdsLibraryPage = () => {
  const [tab, setTab] = useState<"lib" | "perf">("lib")
  return (
    <div style={{ padding: "20px 24px", maxWidth: 1180 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>🗂️ Knihovna reklam</h1>
        <div style={{ display: "flex", gap: 2, background: "var(--bg-subtle, #f3f4f6)", borderRadius: 9, padding: 3 }}>
          {[["lib", "📚 Knihovna"], ["perf", "🏆 Výkon"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as any)}
              style={{ fontSize: 13, padding: "5px 14px", borderRadius: 7, border: "none", cursor: "pointer",
                background: tab === k ? "#fff" : "transparent",
                fontWeight: tab === k ? 600 : 400,
                boxShadow: tab === k ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {tab === "lib" ? <LibraryTab /> : <PerformanceTab />}
    </div>
  )
}

export const config = defineRouteConfig({ label: "Knihovna reklam" })
export default AdsLibraryPage
