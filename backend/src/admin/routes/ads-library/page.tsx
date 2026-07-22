// @ts-nocheck
import React, { useEffect, useMemo, useRef, useState } from "react"
import { defineRouteConfig } from "@medusajs/admin-sdk"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../../lib/sdk"

/* ═════════════════════════════════════════════════════════════
 * Knihovna reklam v2 — rodiny s jazykovými verzemi, lokalizační
 * wizard (modely / režimy / prompty / varianty), fronta jobů,
 * živý výkon z Meta API a odeslání PAUSED reklamy do účtu.
 * ════════════════════════════════════════════════════════════ */

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

const IMG_PROMPTS = {
  swap: "Edit IMAGE 2: the book shown in it must be replaced by the book from IMAGE 1.\n\nThe book in the result must read exactly:\n  Title: \"{BOOK}\"\n  Author: {AUTHOR}\nThe original title must be gone completely. Use the layout, colors and artwork of IMAGE 1, and write all text on the cover in {LANG}.\n\nKeep the person, hands, background, table and whole scene of IMAGE 2 identical. Keep the book's position, angle, size, lighting and shadows. Translate any other text in the image (headlines, captions, badges) into {LANG}, keeping its position, font style, size and color. Do not add prices, badges, stickers, logos or anything not present in IMAGE 2.",
  texts: "Translate every piece of visible text in this image into {LANG}. Keep each text block in exactly the same position, font style, size, color and orientation as the original. Do not remove any text. Do not add any new text, prices, badges, logos, objects or people. Never add a book or book cover that is not in the original image. Keep the composition, characters, colors and background identical apart from the translated words.",
}
const PROMPT_916 = "Reframe to 9:16 portrait. Extend the environment upward and downward using consistent perspective and atmospheric depth. Preserve all original details and the overall aesthetic."

const S = {
  card: { background: "var(--bg-base,#fff)", border: "1.5px solid var(--border-base,#e5e7eb)", borderRadius: 12 } as any,
  chip: { fontSize: 12, padding: "2px 9px", borderRadius: 999, background: "var(--bg-subtle,#f3f4f6)", whiteSpace: "nowrap", fontWeight: 550 } as any,
  btn: { fontSize: 13.5, padding: "7px 13px", borderRadius: 10, border: "1.5px solid var(--border-base,#d1d5db)", background: "var(--bg-base,#fff)", cursor: "pointer", fontWeight: 550 } as any,
  btnPri: { fontSize: 13.5, padding: "7px 13px", borderRadius: 10, border: "1.5px solid #7c3aed", background: "#7c3aed", color: "#fff", cursor: "pointer", fontWeight: 650 } as any,
  input: { fontSize: 13.5, padding: "8px 11px", borderRadius: 9, border: "1.5px solid var(--border-base,#d1d5db)", background: "var(--bg-base,#fff)", width: "100%" } as any,
  mono: { fontFamily: "ui-monospace,Menlo,monospace", fontVariantNumeric: "tabular-nums" } as any,
  eyebrow: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 10.5, letterSpacing: ".1em", textTransform: "uppercase", color: "#6b7280" } as any,
  ptext: { width: "100%", fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, lineHeight: 1.5, border: "1.5px solid var(--border-base,#d1d5db)", borderRadius: 9, background: "var(--bg-subtle,#f9fafb)", padding: "8px 10px", resize: "vertical", minHeight: 56, margin: "4px 0 10px" } as any,
}
const fmtEur = (n: number) => (n || 0).toLocaleString("cs-CZ", { maximumFractionDigits: 0 }) + " €"

/* ── hover zoom ── */
function useZoom() {
  const [z, setZ] = useState<any>(null)
  // global guard: the moment the cursor is NOT over a [data-zoom] element,
  // the zoom disappears — it can never get stuck (re-renders, scroll, clicks)
  useEffect(() => {
    if (!z) return
    const onMove = (e: any) => {
      const t = e.target
      if (!(t instanceof Element) || !t.closest("[data-zoom]")) { setZ(null); return }
      setZ((p: any) => (p ? { ...p, x: e.clientX, y: e.clientY } : p))
    }
    const onAway = () => setZ(null)
    document.addEventListener("mousemove", onMove, true)
    document.addEventListener("scroll", onAway, true)
    document.addEventListener("click", onAway, true)
    return () => {
      document.removeEventListener("mousemove", onMove, true)
      document.removeEventListener("scroll", onAway, true)
      document.removeEventListener("click", onAway, true)
    }
  }, [!!z])
  const move = (e: any) => setZ((p: any) => (p ? { ...p, x: e.clientX, y: e.clientY } : p))
  const show = (e: any, url: string, label?: string) => setZ({ url, label, x: e.clientX, y: e.clientY })
  const hide = () => setZ(null)
  // box grows with the image (portrait creatives stay tall instead of being
  // letterboxed into a square) and is clamped to the viewport
  const BOX = 460
  const el = z ? (
    <div style={{ position: "fixed", zIndex: 90, pointerEvents: "none",
      left: Math.max(8, Math.min(z.x + 20, (window.innerWidth || 1200) - BOX - 16)),
      top: Math.max(8, Math.min(z.y - BOX / 2, (window.innerHeight || 800) - BOX - 40)),
      boxShadow: "0 20px 56px rgba(15,8,18,.45)", borderRadius: 14, overflow: "hidden",
      border: "1px solid #d1d5db", background: "#fff" }}>
      <img src={z.url} alt="" style={{ maxWidth: BOX, maxHeight: BOX, display: "block", background: "#111" }} />
      {z.label && <div style={{ fontSize: 11.5, padding: "6px 10px", textAlign: "center", color: "#6b7280" }}>{z.label}</div>}
    </div>
  ) : null
  return { show, hide, move, el }
}

/* ═══ Knihovna ═══ */
function LibraryTab({ zoom }: any) {
  const qc = useQueryClient()
  const [q, setQ] = useState(""); const [project, setProject] = useState(""); const [tag, setTag] = useState("")
  const [showArchived, setShowArchived] = useState(false)
  const [checked, setChecked] = useState<Record<string, string[]>>({})
  const [openTexts, setOpenTexts] = useState<Record<string, boolean>>({})
  const [openFam, setOpenFam] = useState<Record<string, boolean>>({})
  const [wizard, setWizard] = useState<any>(null)
  const [metaModal, setMetaModal] = useState<any>(null)
  const [bulkSel, setBulkSel] = useState<string[]>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const toggleBulk = (id: string) => setBulkSel((s) => s.includes(id) ? s.filter((x) => x !== id) : [...s, id])

  const { data, isLoading } = useQuery({
    queryKey: ["ads-lib", q, project, tag, showArchived],
    queryFn: () => sdk.client.fetch(`/admin/ads-library/creatives?q=${encodeURIComponent(q)}&project=${project}&tag=${tag}&archived=${showArchived ? "1" : "0"}&limit=200`, { method: "GET" }),
    // while any card is still generating, poll so finished texts/images appear
    // without a manual page refresh
    refetchInterval: (query: any) => {
      const list = query?.state?.data?.creatives || []
      return list.some((c: any) => c.metadata?.generating) ? 5000 : false
    },
  })
  const creatives = data?.creatives || []
  const byId = useMemo(() => Object.fromEntries(creatives.map((c: any) => [c.id, c])), [creatives])
  const roots = creatives.filter((c: any) => !c.translated_from_id || !byId[c.translated_from_id])
  const kidsOf = (id: string) => creatives.filter((c: any) => c.translated_from_id === id)

  const official = useMutation({
    mutationFn: ({ id, variant_id }: any) =>
      sdk.client.fetch(`/admin/ads-library/creatives/${id}/variants`, { method: "POST", body: { action: "official", variant_id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ads-lib"] }),
  })
  const archiveMut = useMutation({
    mutationFn: ({ id, archived }: any) =>
      sdk.client.fetch(`/admin/ads-library/creatives/${id}`, { method: "POST", body: { archived } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ads-lib"] }),
  })
  const genMore = useMutation({
    mutationFn: ({ id, format }: any) =>
      sdk.client.fetch(`/admin/ads-library/creatives/${id}/variants`, { method: "POST", body: { action: "generate", format } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ads-lib"] }),
  })
  const deleteMut = useMutation({
    mutationFn: ({ id }: any) =>
      sdk.client.fetch(`/admin/ads-library/creatives/${id}`, { method: "DELETE" }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ads-lib"] }); qc.invalidateQueries({ queryKey: ["ads-jobs"] }) },
    onError: (e: any) => window.alert(`Smazat nejde: ${e?.message || e}`),
  })

  const tick = (id: string, key: string) => setChecked((c) => {
    const arr = c[id] ? [...c[id]] : []
    const i = arr.indexOf(key); i >= 0 ? arr.splice(i, 1) : arr.push(key)
    return { ...c, [id]: arr }
  })

  const Card = ({ a, isChild }: any) => {
    const sel = checked[a.id] || []
    const tOpen = openTexts[a.id]
    const P = a.primary_texts || [], H = a.headlines || []
    const kids = kidsOf(a.id)
    const famOpen = openFam[a.id]
    const img = a.image_1x1_url || a.video_thumb_url
    const generating = a.metadata?.generating
    const failed = a.metadata?.failed
    const row = (t: string, i: number, pref: string) => {
      const key = pref + i, on = sel.includes(key)
      return (
        <label key={key} style={{ display: "flex", gap: 10, alignItems: "flex-start", padding: "4px 8px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}>
          <input type="checkbox" checked={on} onChange={() => tick(a.id, key)} style={{ marginTop: 4, accentColor: "#7c3aed", flexShrink: 0 }} />
          <span style={{ ...S.mono, fontSize: 10.5, color: "#9ca3af", width: 26, flexShrink: 0, paddingTop: 3, fontWeight: 700 }}>{pref}{i + 1}</span>
          <span style={{ minWidth: 0, overflowWrap: "anywhere" }}>{t}</span>
        </label>)
    }
    return (
      <div style={{ ...S.card, overflow: "visible" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap", padding: "12px 16px", borderBottom: "1px solid var(--border-base,#e5e7eb)" }}>
          <input type="checkbox" checked={bulkSel.includes(a.id)} onChange={() => toggleBulk(a.id)}
            title="Vybrat pro hromadné odeslání do Meta"
            style={{ width: 17, height: 17, accentColor: "#7c3aed", flexShrink: 0, cursor: "pointer" }} />
          <b style={{ fontSize: isChild ? 14.5 : 15.5, overflowWrap: "anywhere" }}>{a.name}</b>
          <span style={S.chip}>{PROJECTS[a.project_id]?.flag || "🌐"} {a.language}</span>
          <span style={S.chip}>{a.project_id}</span>
          {a.tag === "winner" && <span style={{ ...S.chip, background: "#dcfce7", color: "#15803d" }}>🏆 winner</span>}
          {a.source === "translation" && <span style={{ ...S.chip, background: "#ede9fe", color: "#7c3aed" }}>🍌 lokalizace</span>}
          {a.meta_ad_id && <span style={{ ...S.chip, background: "#dcfce7", color: "#15803d" }}>🚀 v Meta účtu</span>}
          {generating && <span style={{ ...S.chip, background: "#fef3c7", color: "#b45309" }}>⏳ generuje se…</span>}
          {failed && <span style={{ ...S.chip, background: "#fee2e2", color: "#b91c1c" }} title={failed}>⚠️ chyba</span>}
          <span style={{ ...S.mono, fontSize: 12, color: "#6b7280", marginLeft: "auto" }}>
            {a.perf ? <>ROAS <b style={{ color: "#111827" }}>{(a.perf.roas || 0).toFixed(1)}×</b> · {a.perf.sales || 0} prodejů</> : "zatím bez dat"}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isChild ? "104px minmax(0,1fr)" : "136px minmax(0,1fr)", gap: 18, padding: "14px 16px" }}>
          <div style={{ textAlign: "center" }}>
            {img ? (
              <img src={img} alt={a.name} data-zoom="1"
                onMouseEnter={(e) => zoom.show(e, img, a.name)} onMouseMove={zoom.move} onMouseLeave={zoom.hide}
                style={{ width: isChild ? 100 : 132, height: isChild ? 100 : 132, objectFit: "cover", borderRadius: 10, border: "1px solid #e5e7eb", cursor: "zoom-in" }} />
            ) : (
              <div style={{ width: isChild ? 100 : 132, height: isChild ? 100 : 132, borderRadius: 10, background: "var(--bg-subtle,#f3f4f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, margin: "0 auto" }}>
                {generating ? "⏳" : "🖼️"}
              </div>)}
          </div>
          <div style={{ minWidth: 0 }}>
            {tOpen ? (<>
              <span style={S.eyebrow}>Primary texty</span>
              {P.map((t: string, i: number) => row(t, i, "P"))}
              <span style={{ ...S.eyebrow, display: "block", marginTop: 6 }}>Headliny</span>
              {H.map((t: string, i: number) => row(t, i, "H"))}
              <button style={{ ...S.btn, border: "none", color: "#7c3aed", padding: "4px" }} onClick={() => setOpenTexts((o) => ({ ...o, [a.id]: false }))}>Sbalit texty ▴</button>
            </>) : (<>
              <div style={{ fontSize: 14, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b style={{ ...S.mono, fontSize: 10.5, color: "#111827", marginRight: 6 }}>P1</b>{P[0] || "—"}</div>
              <div style={{ fontSize: 14, color: "#6b7280", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}><b style={{ ...S.mono, fontSize: 10.5, color: "#111827", marginRight: 6 }}>H1</b>{H[0] || "—"}</div>
              <button style={{ ...S.btn, border: "none", color: "#7c3aed", padding: "4px" }} onClick={() => setOpenTexts((o) => ({ ...o, [a.id]: true }))}>📖 Zobrazit všechny texty ({P.length + H.length}) ▾</button>
            </>)}
            {a.translated_from_id && byId[a.translated_from_id] &&
              <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 5 }}>🍌 lokalizováno z: <b>{byId[a.translated_from_id].name}</b></div>}
            {a.variants?.length > 0 && (
              <div style={{ display: "flex", gap: 7, alignItems: "center", flexWrap: "wrap", marginTop: 9 }}>
                <span style={{ fontSize: 11.5, color: "#6b7280" }}>🎛️ Varianty ({a.variants.length}):</span>
                {a.variants.map((v: any) => (
                  <span key={v.id} data-zoom="1"
                    title={`${v.format} · V${v.variant_no} · ${v.model_id || ""}${v.metadata?.cost_usd != null ? ` · ~$${v.metadata.cost_usd}` : ""}${v.metadata?.swap_ok === false ? " · ⚠️ obálka se nezměnila" : ""}`}
                    onMouseEnter={(e) => zoom.show(e, v.url, `${v.format} · V${v.variant_no}${v.metadata?.cost_usd != null ? ` · ~$${v.metadata.cost_usd}` : ""}${v.metadata?.swap_ok === false ? " · ⚠️ obálka se nezměnila" : ""}`)}
                    onMouseMove={zoom.move} onMouseLeave={zoom.hide}
                    onClick={() => official.mutate({ id: a.id, variant_id: v.id })}
                    style={{ width: v.format === "1:1" ? 44 : 26, height: 44, borderRadius: 8, position: "relative", cursor: "pointer", overflow: "hidden",
                      border: v.is_official ? "2px solid #15803d" : v.metadata?.swap_ok === false ? "2px solid #f59e0b" : "2px solid var(--border-base,#e5e7eb)",
                      boxShadow: v.is_official ? "0 0 0 2px #dcfce7" : "none" }}>
                    <img src={v.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                    {v.is_official && <span style={{ position: "absolute", top: -1, right: 0, fontSize: 9 }}>✅</span>}
                    {!v.is_official && v.metadata?.swap_ok === false && <span style={{ position: "absolute", top: -1, right: 0, fontSize: 9 }}>⚠️</span>}
                  </span>))}
                <button style={{ ...S.btn, padding: "4px 9px", fontSize: 12 }} disabled={genMore.isPending}
                  onClick={() => genMore.mutate({ id: a.id, format: "1:1" })}>{genMore.isPending ? "…" : "＋"}</button>
              </div>)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", padding: "10px 16px", borderTop: "1px solid var(--border-base,#e5e7eb)", background: "var(--bg-subtle,#f9fafb)", borderRadius: "0 0 12px 12px" }}>
          <button style={sel.length ? S.btnPri : { ...S.btnPri, opacity: .4, cursor: "not-allowed" }} disabled={!sel.length}
            onClick={() => setWizard({ creative: a, sel })}>🌍 Lokalizovat ({sel.length})</button>
          <button style={S.btn} onClick={() => {
            const all = [...P.map((_: any, i: number) => "P" + i), ...H.map((_: any, i: number) => "H" + i)]
            setChecked((c) => ({ ...c, [a.id]: sel.length === all.length ? [] : all }))
          }}>{sel.length === P.length + H.length && sel.length > 0 ? "✖️ Zrušit výběr" : "☑️ Označit vše"}</button>
          {img && <a href={img} target="_blank" rel="noreferrer" style={{ ...S.btn, textDecoration: "none", color: "inherit", display: "inline-flex", alignItems: "center" }}>⬇️ Obrázky</a>}
          <button style={S.btn} onClick={() => {
            // with an active bulk selection this button joins the batch flow —
            // clicking it on one card used to silently send just that card
            if (bulkSel.length > 0) {
              if (!bulkSel.includes(a.id)) toggleBulk(a.id)
              setBulkOpen(true)
            } else {
              setMetaModal({ creative: a, kids: kidsOf(a.id) })
            }
          }}>🚀 Do Meta účtu{bulkSel.length > 0 ? ` (${bulkSel.includes(a.id) ? bulkSel.length : bulkSel.length + 1})` : ""}</button>
          {a.archived
            ? <button style={{ ...S.btn, borderColor: "#15803d", color: "#15803d" }} disabled={archiveMut.isPending}
                onClick={() => archiveMut.mutate({ id: a.id, archived: false })}>↩️ Obnovit z archivu</button>
            : <button style={S.btn} disabled={archiveMut.isPending} title="Nic se nemaže — karta se jen přesune do Archivu"
                onClick={() => archiveMut.mutate({ id: a.id, archived: true })}>🗄️ Archivovat</button>}
          <button style={{ ...S.btn, borderColor: "#fecaca", color: "#b91c1c" }} disabled={deleteMut.isPending}
            title="Smaže kartu včetně všech variant a záznamu ve frontě"
            onClick={() => {
              if (window.confirm(`Opravdu smazat kartu „${a.name}" včetně ${a.variants?.length || 0} variant? Tohle je nevratné.`)) {
                deleteMut.mutate({ id: a.id })
              }
            }}>🗑️ Smazat</button>
          {kids.length > 0 && (
            <button style={{ ...S.btn, marginLeft: "auto", borderColor: "#ede9fe", background: "#ede9fe", color: "#7c3aed" }}
              onClick={() => setOpenFam((o) => ({ ...o, [a.id]: !famOpen }))}>
              🌍 Jazykové verze <b>{kids.length}</b> {famOpen ? "▴" : "▾"}</button>)}
        </div>
      </div>)
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 14 }}>
        <input style={{ ...S.input, flex: 1, minWidth: 200 }} placeholder="🔍 Hledat v textech…" value={q} onChange={(e) => setQ(e.target.value)} />
        <select style={{ ...S.input, width: "auto" }} value={project} onChange={(e) => setProject(e.target.value)}>
          <option value="">Projekt: všechny</option>
          {Object.entries(PROJECTS).map(([k, v]) => <option key={k} value={k}>{v.flag} {k}</option>)}
        </select>
        <select style={{ ...S.input, width: "auto" }} value={tag} onChange={(e) => setTag(e.target.value)}>
          <option value="">Štítek: vše</option><option value="winner">🏆 winner</option><option value="test">🧪 test</option>
        </select>
        <button style={{ ...S.btn, ...(showArchived ? { background: "#111827", color: "#fff", borderColor: "#111827" } : {}) }}
          onClick={() => setShowArchived(!showArchived)}>🗄️ Archiv{showArchived ? " ✓" : ""}</button>
        <span style={{ fontSize: 12.5, color: "#6b7280", alignSelf: "center", marginLeft: "auto" }}>{data?.count ?? "…"} reklam</span>
      </div>
      {isLoading && <div style={{ padding: 30, textAlign: "center", color: "#6b7280" }}>Načítám…</div>}
      {showArchived && <div style={{ ...S.card, padding: "10px 16px", marginBottom: 14, fontSize: 13, color: "#6b7280", background: "var(--bg-subtle,#f9fafb)" }}>
        🗄️ <b>Archiv</b> — karty jsou jen odložené z dohledu, nic není smazané. „↩️ Obnovit" je vrátí do knihovny.</div>}
      {!isLoading && !creatives.length &&
        <div style={{ ...S.card, padding: 30, textAlign: "center", color: "#6b7280" }}>{showArchived ? "Archiv je prázdný." : "Knihovna je prázdná — importuj vítěze ze záložky 🏆 Výkon."}</div>}
      {roots.map((a: any) => {
        const kids = kidsOf(a.id)
        return (
          <div key={a.id} style={{ marginBottom: 16 }}>
            <Card a={a} isChild={false} />
            {kids.length > 0 && openFam[a.id] && (
              <div style={{ position: "relative", marginLeft: 34, paddingLeft: 30, paddingTop: 14 }}>
                <div style={{ position: "absolute", left: 0, top: -4, bottom: 44, width: 2.5, background: "#d8b4fe", borderRadius: 3 }} />
                {kids.map((k: any) => (
                  <div key={k.id} style={{ position: "relative", marginBottom: 14 }}>
                    <div style={{ position: "absolute", left: -30, top: -16, width: 28, height: 46, borderLeft: "2.5px solid #d8b4fe", borderBottom: "2.5px solid #d8b4fe", borderBottomLeftRadius: 16 }} />
                    <Card a={k} isChild={true} />
                  </div>))}
              </div>)}
          </div>)
      })}
      {bulkSel.length > 0 && (
        <div style={{ position: "sticky", bottom: 14, marginTop: 14, background: "#7c3aed", color: "#fff", borderRadius: 13, padding: "12px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "0 8px 30px rgba(124,58,237,.35)", zIndex: 20 }}>
          <b style={{ fontSize: 14 }}>{bulkSel.length} {bulkSel.length === 1 ? "karta vybrána" : bulkSel.length < 5 ? "karty vybrány" : "karet vybráno"}</b>
          <span style={{ marginLeft: "auto" }} />
          <button style={{ ...S.btn, background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,.5)" }}
            onClick={() => setBulkSel([])}>✖️ Zrušit výběr</button>
          <button style={{ ...S.btn, background: "rgba(255,255,255,.16)", color: "#fff", border: "1px solid rgba(255,255,255,.45)", fontWeight: 650 }}
            onClick={() => setWizard({ creatives: creatives.filter((c: any) => bulkSel.includes(c.id)), sel: [] })}>🌍 Hromadně lokalizovat ({bulkSel.length})</button>
          <button style={{ ...S.btn, background: "#fff", color: "#7c3aed", border: "none", fontWeight: 700 }}
            onClick={() => setBulkOpen(true)}>🚀 Hromadně do Meta ({bulkSel.length})</button>
        </div>)}
      {bulkOpen && <BulkMetaModal creatives={creatives} selIds={bulkSel} kidsOf={kidsOf}
        onClose={(sent: boolean) => { setBulkOpen(false); if (sent) { setBulkSel([]); qc.invalidateQueries({ queryKey: ["ads-lib"] }); qc.invalidateQueries({ queryKey: ["ads-jobs"] }) } }} />}
      {wizard && <LocalizeWizard wizard={wizard} onClose={() => { setWizard(null); qc.invalidateQueries({ queryKey: ["ads-lib"] }); qc.invalidateQueries({ queryKey: ["ads-jobs"] }) }} />}
      {metaModal && <MetaModal m={metaModal} onClose={() => { setMetaModal(null); qc.invalidateQueries({ queryKey: ["ads-lib"] }) }} />}
    </div>)
}

/* ═══ Lokalizační wizard ═══ */
function LocalizeWizard({ wizard, onClose }: any) {
  // single mode: wizard.creative + wizard.sel (vybrané texty)
  // bulk mode: wizard.creatives[] — vždy všechny texty, indexy se neposílají
  const cards = wizard.creatives || [wizard.creative]
  const bulk = cards.length > 1 || !!wizard.creatives
  const a = cards[0]
  const [targets, setTargets] = useState<string[]>([])
  const [imgModel, setImgModel] = useState("nano-banana-pro")
  const [imgMode, setImgMode] = useState<"swap" | "texts">("swap")
  const [imgPrompt, setImgPrompt] = useState(IMG_PROMPTS.swap)
  const [p916, setP916] = useState(PROMPT_916)
  // 1 variant per format by default — every extra 1:1 also spawns an extra
  // 9:16 reframe, so "2" quietly meant 4 images (~$0.56) per job
  const [imgCount, setImgCount] = useState(1)
  const [f11, setF11] = useState(true); const [f916, setF916] = useState(true)
  const [txtModel, setTxtModel] = useState("claude-opus-4-8")
  const [txtCount, setTxtCount] = useState(1)
  const [sent, setSent] = useState<any>(null)

  const modelsQ = useQuery({
    queryKey: ["ads-models"],
    queryFn: () => sdk.client.fetch("/admin/ads-library/localize", { method: "GET" }),
  })
  const imgModels = modelsQ.data?.image_models || []
  const txtModels = modelsQ.data?.text_models || []

  const run = useMutation({
    mutationFn: () => sdk.client.fetch("/admin/ads-library/localize", {
      method: "POST",
      body: {
        source_creative_ids: cards.map((c: any) => c.id), target_projects: targets,
        img_model: imgModel, img_mode: imgMode, img_prompt: imgPrompt, p916,
        img_count: imgCount, formats: [...(f11 ? ["1:1"] : []), ...(f916 ? ["9:16"] : [])],
        txt_model: txtModel, txt_count: txtCount,
        primary_indexes: bulk ? [] : wizard.sel.filter((k: string) => k[0] === "P").map((k: string) => +k.slice(1)),
        headline_indexes: bulk ? [] : wizard.sel.filter((k: string) => k[0] === "H").map((k: string) => +k.slice(1)),
      },
    }),
    onSuccess: (r: any) => setSent(r),
  })

  const cnt = (cur: number, set: any, max: number) => (
    <span style={{ display: "inline-flex", gap: 3, background: "var(--bg-subtle,#f3f4f6)", borderRadius: 999, padding: 3 }}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <button key={n} onClick={() => set(n)}
          style={{ ...S.mono, fontSize: 12.5, padding: "4px 11px", borderRadius: 999, border: "none", cursor: "pointer",
            background: cur === n ? "#7c3aed" : "transparent", color: cur === n ? "#fff" : "#6b7280", fontWeight: cur === n ? 700 : 400 }}>{n}</button>))}
    </span>)

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "4vh 16px" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.card, maxWidth: 700, width: "100%", maxHeight: "90vh", overflow: "auto", background: "var(--bg-base,#fff)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", position: "sticky", top: 0, background: "var(--bg-base,#fff)", zIndex: 2 }}>
          <b style={{ fontSize: 15.5 }}>🌍 Lokalizovat — {bulk ? `${cards.length} karet` : a.name}</b>
          <button style={{ ...S.btn, border: "none", marginLeft: "auto" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "16px 18px" }}>
          {sent ? (
            <div style={{ padding: 12 }}>
              <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 8 }}>🚀 Spuštěno {sent.jobs.length} {sent.jobs.length === 1 ? "job" : sent.jobs.length < 5 ? "joby" : "jobů"}</div>
              {sent.skipped?.length > 0 && (
                <div style={{ fontSize: 12.5, color: "#92400e", background: "#fef3c7", borderRadius: 8, padding: "7px 10px", marginBottom: 8 }}>
                  ⏭️ Přeskočeno {sent.skipped.length}× (karta už je v cílovém jazyce): {sent.skipped.map((x: any) => `${x.card} → ${x.target}`).join(", ")}</div>)}
              <div style={{ fontSize: 13.5, color: "#6b7280", lineHeight: 1.6 }}>
                Generování běží na pozadí — průběh sleduj v záložce <b>⚙️ Fronta</b>. Po dokončení se nová jazyková verze objeví
                pod originálem se všemi variantami. Můžeš toto okno zavřít.</div>
            </div>
          ) : (<>
            {bulk && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
                {cards.map((c: any) => (
                  <span key={c.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-subtle,#f3f4f6)", borderRadius: 8, padding: "4px 9px 4px 4px", fontSize: 12 }}>
                    {(c.image_1x1_url || c.video_thumb_url) && <img src={c.image_1x1_url || c.video_thumb_url} style={{ width: 26, height: 26, borderRadius: 5, objectFit: "cover" }} />}
                    {PROJECTS[c.project_id]?.flag} {c.name}</span>))}
              </div>)}
            <span style={S.eyebrow}>Cílové projekty{bulk ? " (vlastní jazyk karty se automaticky přeskočí)" : ""}</span>
            <div style={{ display: "flex", gap: 7, flexWrap: "wrap", margin: "8px 0 16px" }}>
              {Object.entries(PROJECTS).filter(([k]) => bulk || k !== a.project_id).map(([k, v]) => (
                <button key={k} onClick={() => setTargets((t) => t.includes(k) ? t.filter((x) => x !== k) : [...t, k])}
                  style={{ ...S.btn, borderRadius: 999, padding: "6px 12px", fontSize: 13,
                    ...(targets.includes(k) ? { borderColor: "#7c3aed", background: "#ede9fe", color: "#7c3aed", fontWeight: 650 } : {}) }}>
                  {v.flag} {k}</button>))}
            </div>

            <span style={S.eyebrow}>🖼️ Obrázky</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "7px 0 10px", flexWrap: "wrap" }}>
              <label style={{ fontSize: 12.5, color: "#6b7280", minWidth: 62 }}>Model</label>
              <select style={{ ...S.input, flex: 1, minWidth: 220, width: "auto" }} value={imgModel} onChange={(e) => setImgModel(e.target.value)}>
                {imgModels.map((m: any) => <option key={m.id} value={m.id} disabled={!m.available}>{m.label}{m.priced === false ? " ⚠️ bez ceníku" : ""}{m.available ? "" : " — čeká na GEMINI_API_KEY"}</option>)}
              </select>
              <RateHint models={imgModels} id={imgModel} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start", margin: "0 0 10px", flexWrap: "wrap" }}>
              <label style={{ fontSize: 12.5, color: "#6b7280", minWidth: 62, paddingTop: 9 }}>Režim</label>
              {[["swap", "🔄 Book swap", "přehodí cover + přeloží headline v obrázku"],
                ["texts", "✍️ Akviziční", "jen předělá texty v obrázku do jazyka"]].map(([id, label, desc]) => (
                <label key={id} style={{ display: "inline-flex", alignItems: "flex-start", gap: 8, border: "1.5px solid", borderRadius: 10, padding: "9px 13px", cursor: "pointer", fontSize: 13.5,
                  borderColor: imgMode === id ? "#7c3aed" : "var(--border-base,#d1d5db)", background: imgMode === id ? "#ede9fe" : "transparent" }}>
                  <input type="radio" checked={imgMode === id} onChange={() => { setImgMode(id as any); setImgPrompt(IMG_PROMPTS[id]) }} style={{ accentColor: "#7c3aed", marginTop: 3 }} />
                  <span><b>{label}</b><small style={{ display: "block", color: "#6b7280", fontSize: 11, fontWeight: 400 }}>{desc}</small></span>
                </label>))}
            </div>
            {imgMode === "swap" && (
              <div style={{ background: "var(--bg-subtle,#f3f4f6)", borderRadius: 9, padding: "9px 12px", fontSize: 12, color: "#6b7280", marginBottom: 9 }}>
                📖 K promptu se automaticky přiloží <b>referenční cover cílové knihy</b> (registr assetů — per projekt).</div>)}
            <span style={S.eyebrow}>Prompt — můžeš upravit ({"{LANG}"} = cílový jazyk)</span>
            <textarea style={S.ptext} value={imgPrompt} onChange={(e) => setImgPrompt(e.target.value)} />
            <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 10px" }}>
              <label style={{ fontSize: 12.5, color: "#6b7280", minWidth: 62 }}>Varianty</label>
              {cnt(imgCount, setImgCount, 4)}
              <span style={{ fontSize: 12, color: "#6b7280" }}>na každý formát</span>
            </div>
            <label style={{ display: "flex", gap: 10, padding: "7px 0", fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={f11} onChange={() => setF11(!f11)} style={{ accentColor: "#7c3aed", marginTop: 3 }} />
              <span><b>1:1 — feed</b><small style={{ display: "block", color: "#6b7280", fontSize: 12 }}>hlavní generování podle promptu výše</small></span>
            </label>
            <label style={{ display: "flex", gap: 10, padding: "7px 0", fontSize: 14, cursor: "pointer" }}>
              <input type="checkbox" checked={f916} onChange={() => setF916(!f916)} style={{ accentColor: "#7c3aed", marginTop: 3 }} />
              <span><b>9:16 — Reels / Stories</b><small style={{ display: "block", color: "#6b7280", fontSize: 12 }}>automatický reframe z hotové 1:1 (image-to-image)</small></span>
            </label>
            {f916 && (<div style={{ margin: "0 0 6px 26px" }}>
              <span style={S.eyebrow}>Prompt 9:16 reframe</span>
              <textarea style={S.ptext} value={p916} onChange={(e) => setP916(e.target.value)} />
            </div>)}

            <span style={{ ...S.eyebrow, display: "block", marginTop: 8 }}>✍️ Texty ({bulk ? "všechny primaries + headliny každé karty" : `${wizard.sel.length} vybraných`})</span>
            <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "7px 0 10px", flexWrap: "wrap" }}>
              <label style={{ fontSize: 12.5, color: "#6b7280", minWidth: 62 }}>Model</label>
              <select style={{ ...S.input, flex: 1, minWidth: 220, width: "auto" }} value={txtModel} onChange={(e) => setTxtModel(e.target.value)}>
                <optgroup label="Anthropic">
                  {txtModels.filter((m: any) => m.provider === "anthropic").map((m: any) =>
                    <option key={m.id} value={m.id} disabled={!m.available}>{m.label}{m.priced === false ? " ⚠️ bez ceníku" : ""}</option>)}
                </optgroup>
                <optgroup label="OpenAI">
                  {txtModels.filter((m: any) => m.provider === "openai").map((m: any) =>
                    <option key={m.id} value={m.id} disabled={!m.available}>{m.label}{m.priced === false ? " ⚠️ bez ceníku" : ""}{m.available ? "" : " — čeká na OPENAI_API_KEY"}</option>)}
                </optgroup>
              </select>
              <RateHint models={txtModels} id={txtModel} />
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "center", margin: "0 0 12px" }}>
              <label style={{ fontSize: 12.5, color: "#6b7280", minWidth: 62 }}>Varianty</label>
              {cnt(txtCount, setTxtCount, 3)}
              <span style={{ fontSize: 12, color: "#6b7280" }}>nezávislé překlady (uloží se všechny)</span>
            </div>
            <div style={{ background: "var(--bg-subtle,#f3f4f6)", borderRadius: 9, padding: "9px 12px", fontSize: 12, color: "#6b7280" }}>
              Všechny varianty se uloží (MinIO + DB) — oficiální pak označíš na kartě. CTA, cena a odkaz jdou ze statické mapy projektu.
              Každý překlad automaticky projde 🧬 humanizer kontrolou (2. průchod odstraní AI fráze) — nález uvidíš ve frontě.</div>
          </>)}
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-base,#fff)" }}>
          <button style={S.btn} onClick={onClose}>Zavřít</button>
          {!sent && <button style={targets.length ? S.btnPri : { ...S.btnPri, opacity: .4 }} disabled={!targets.length || run.isPending}
            onClick={() => run.mutate()}>{run.isPending ? "Spouštím…" : `🚀 Spustit (${bulk ? `${cards.length} × ${targets.length}` : targets.length})`}</button>}
        </div>
      </div>
    </div>)
}

/* ═══ Výběr FB stránky (sdílené single + bulk) ═══ */
function PagePicker({ account, value, onChange }: any) {
  const q = useQuery({
    queryKey: ["ads-fb-pages", account],
    queryFn: () => sdk.client.fetch(`/admin/ads-library/meta/pages?account=${encodeURIComponent(account)}`, { method: "GET" }),
    enabled: !!account,
    staleTime: 5 * 60 * 1000,
  })
  const pages = q.data?.pages || []
  // default = stránka, kterou účet už používá (přesně to, co by odesílač zvolil sám)
  useEffect(() => {
    if (!value && pages.length) onChange(String(pages.find((p: any) => p.in_use)?.id || pages[0].id))
  }, [pages.length])

  if (!account) return null
  return (
    <div style={{ marginTop: 10 }}>
      <span style={S.eyebrow}>📘 Facebook stránka — pod kterou reklamy vzniknou</span>
      {q.isLoading ? <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 6 }}>načítám stránky účtu…</div>
      : q.error ? <div style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 6 }}>stránky nejdou načíst ({(q.error as any)?.message || "chyba"}) — použije se stránka z posledních reklam účtu</div>
      : !pages.length ? <div style={{ fontSize: 12.5, color: "#92400e", marginTop: 6 }}>účet nenabízí žádnou stránku — použije se ta z posledních reklam</div>
      : (<>
        <select style={{ ...S.input, marginTop: 6 }} value={value || ""} onChange={(e) => onChange(e.target.value)}>
          {pages.map((p: any) => (
            <option key={p.id} value={p.id}>{p.in_use ? "★ " : ""}{p.name}{p.in_use ? " — už se v účtu používá" : ""}</option>))}
        </select>
        <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 4 }}>
          ★ = stránka, pod kterou účet inzeruje teď. Instagram se převezme od ní.</div>
      </>)}
    </div>)
}

/* ═══ Bulk Meta modal ═══ */
function BulkMetaModal({ creatives, selIds, kidsOf, onClose }: any) {
  const [q, setQ] = useState("")
  const [target, setTarget] = useState<any>(null)
  const [resolving, setResolving] = useState(false)
  const [resolveErr, setResolveErr] = useState("")
  const [chosen, setChosen] = useState<Record<string, string>>({}) // selectedCardId -> version creative id
  const [vars, setVars] = useState<Record<string, string[]>>({})   // versionId -> selected 1:1 variant urls
  const [jobId, setJobId] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [pageId, setPageId] = useState<string>("")

  const byId = useMemo(() => Object.fromEntries(creatives.map((c: any) => [c.id, c])), [creatives])
  const rows = selIds.map((id: string) => byId[id]).filter(Boolean)
  const versionsOf = (card: any) => [card, ...kidsOf(card.id)]
  const versionFor = (card: any) => byId[chosen[card.id]] || card
  const accLang = target?.account_name?.match(/\(([A-Z]{2})\)/)?.[1] || null

  const resolve = async () => {
    setResolving(true); setResolveErr(""); setTarget(null); setPageId("")
    try {
      const r: any = await sdk.client.fetch(`/admin/ads-library/meta/resolve-adset?q=${encodeURIComponent(q)}`, { method: "GET" })
      setTarget(r)
      // preselect the language version matching the account's (XX) suffix
      const lang = r.account_name?.match(/\(([A-Z]{2})\)/)?.[1]
      if (lang) {
        const next: Record<string, string> = {}
        for (const card of rows) {
          const hit = versionsOf(card).find((v: any) => v.language === lang)
          if (hit) next[card.id] = hit.id
        }
        setChosen((c) => ({ ...next, ...c }))
      }
    } catch (e: any) { setResolveErr(e?.message || "ad set nejde načíst") }
    setResolving(false)
  }

  const toggleVar = (versionId: string, url: string) => setVars((p) => {
    const cur = p[versionId] || []
    return { ...p, [versionId]: cur.includes(url) ? cur.filter((u) => u !== url) : [...cur, url] }
  })
  const plannedFor = (v: any) => Math.max(1, (vars[v.id] || []).length)
  const totalPlanned = rows.reduce((n: number, card: any) => n + plannedFor(versionFor(card)), 0)

  const jobsQ = useQuery({
    queryKey: ["ads-jobs"],
    queryFn: () => sdk.client.fetch("/admin/ads-library/jobs", { method: "GET" }),
    enabled: !!jobId,
    refetchInterval: jobId ? 3000 : false,
  })
  const job = jobId ? (jobsQ.data?.jobs || []).find((j: any) => j.id === jobId) : null
  const jobFinished = job && (job.status === "done" || job.status === "failed")
  // step.key = posledních 8 znaků creative id (+ "-vN" u variant) — z toho jde
  // určit, které karty neprošly, a nabídnout opakování jen pro ně
  const failedSteps = (job?.steps || []).filter((s: any) => s.status === "failed")
  const okSteps = (job?.steps || []).filter((s: any) => s.status === "done")
  const failedCardIds = rows
    .filter((card: any) => {
      const vid = versionFor(card).id.slice(-8)
      return failedSteps.some((s: any) => String(s.key).split("-v")[0] === vid)
    })
    .map((c: any) => c.id)
  // výběr v knihovně se ruší jen při čistém průchodu — po chybě zůstane,
  // aby šlo hned zkusit znovu bez opětovného zaškrtávání
  const cleanRun = !!jobFinished && failedSteps.length === 0 && okSteps.length > 0

  const start = async (onlyCardIds?: string[]) => {
    if (target?.can_advertise === false) return
    setStarting(true)
    try {
      const src = onlyCardIds?.length ? rows.filter((c: any) => onlyCardIds.includes(c.id)) : rows
      const items = src.map((card: any) => {
        const v = versionFor(card)
        return { creative_id: v.id, variant_urls: vars[v.id] || [] }
      })
      const r: any = await sdk.client.fetch("/admin/ads-library/bulk-send-to-meta", {
        method: "POST", body: { adset: q, items, page_id: pageId || null },
      })
      setJobId(r.job_id)
    } catch (e: any) { setResolveErr(e?.message || "spuštění selhalo") }
    setStarting(false)
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "4vh 16px" }}
      onClick={(e) => e.target === e.currentTarget && onClose(cleanRun)}>
      <div style={{ ...S.card, maxWidth: 680, width: "100%", maxHeight: "90vh", overflow: "auto", background: "var(--bg-base,#fff)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", position: "sticky", top: 0, background: "var(--bg-base,#fff)", zIndex: 2 }}>
          <b style={{ fontSize: 15.5 }}>🚀 Hromadné odeslání — {rows.length} {rows.length === 1 ? "karta" : "karet"} → Meta</b>
          <button style={{ ...S.btn, border: "none", marginLeft: "auto" }} onClick={() => onClose(cleanRun)}>✕</button>
        </div>
        <div style={{ padding: "16px 18px" }}>
          <div style={{ border: "1.5px solid #7c3aed", borderRadius: 11, padding: "11px 13px", background: "#faf5ff", marginBottom: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 6 }}>⚡ Cílový ad set — vlož ID nebo URL z Ads Manageru</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input style={{ ...S.input, ...S.mono, flex: 1 }} placeholder="ID (120211234…) nebo celá URL"
                value={q} onChange={(e) => { setQ(e.target.value); setTarget(null) }} disabled={!!jobId} />
              <button style={q.trim() && !target ? S.btnPri : { ...S.btnPri, opacity: .4 }} disabled={!q.trim() || !!target || resolving}
                onClick={resolve}>{resolving ? "…" : "Ověřit"}</button>
            </div>
            {resolveErr && <div style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 6 }}>{resolveErr}</div>}
            {target && <div style={{ fontSize: 12.5, color: "#15803d", fontWeight: 650, marginTop: 7 }}>
              ✓ {target.account_name} → {target.campaign_name} → <b>{target.name}</b></div>}
            {target?.can_advertise === false && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 9, padding: "10px 12px", fontSize: 12.5, color: "#b91c1c", marginTop: 8, lineHeight: 1.55 }}>
                ⛔ <b>Účet nemá oprávnění vytvářet reklamy.</b> Token má na <b>{target.account_name}</b> jen{" "}
                {(target.user_tasks || []).join(", ") || "žádné role"} — chybí <b>ADVERTISE</b> (Správa kampaní).
                Přidej ho v Business Settings → Reklamní účty → {target.account} → Lidé / System users, pak dej znovu Ověřit.</div>)}
            {target && <PagePicker account={target.account} value={pageId} onChange={setPageId} />}
          </div>

          {target && !jobId && (<>
            {rows.map((card: any) => {
              const v = versionFor(card)
              const v11 = (v.variants || []).filter((x: any) => x.format === "1:1")
              const already = v.metadata?.meta_adset_id === target.adset_id
              const mismatch = accLang && v.language && accLang !== v.language
              return (
                <div key={card.id} style={{ borderTop: "1px dashed var(--border-base,#e5e7eb)", padding: "11px 0", display: "grid", gridTemplateColumns: "52px minmax(0,1fr) auto", gap: 12, alignItems: "start" }}>
                  <img src={v.image_1x1_url || card.image_1x1_url} alt="" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, border: "1px solid #e5e7eb" }} />
                  <div style={{ minWidth: 0 }}>
                    <b style={{ fontSize: 13 }}>{card.name}</b>
                    {already && <span style={{ ...S.mono, fontSize: 10.5, marginLeft: 7, padding: "1px 8px", borderRadius: 999, background: "#fef3c7", color: "#b45309" }}>už v tomto ad setu</span>}
                    {versionsOf(card).length > 1 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap", margin: "5px 0 2px" }}>
                        {versionsOf(card).map((ver: any) => (
                          <button key={ver.id} onClick={() => setChosen((c) => ({ ...c, [card.id]: ver.id }))}
                            style={{ ...S.btn, padding: "3px 10px", fontSize: 11.5, ...(v.id === ver.id ? { borderColor: "#7c3aed", background: "#ede9fe", fontWeight: 650 } : {}) }}>
                            {PROJECTS[ver.project_id]?.flag || "🌐"} {ver.language}{!ver.translated_from_id ? " (zdroj)" : ""}</button>))}
                      </div>)}
                    {mismatch && <div style={{ fontSize: 11.5, color: "#b45309" }}>⚠️ {v.language} verze do účtu ({accLang})</div>}
                    {v11.length > 1 ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
                        {v11.map((x: any) => {
                          const on = (vars[v.id] || []).includes(x.url)
                          return (
                            <span key={x.id} onClick={() => toggleVar(v.id, x.url)}
                              style={{ width: 40, height: 40, borderRadius: 8, overflow: "hidden", cursor: "pointer", position: "relative",
                                border: on ? "2px solid #7c3aed" : "2px solid var(--border-base,#e5e7eb)", boxShadow: on ? "0 0 0 2px #ede9fe" : "none" }}>
                              <img src={x.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                              {on && <span style={{ position: "absolute", top: -2, right: 0, fontSize: 10 }}>✅</span>}
                            </span>)
                        })}
                        <span style={{ fontSize: 11, color: "#6b7280" }}>každá vybraná 1:1 = samostatná reklama · nic nevybráno = oficiální</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 4 }}>
                        1:1 · všech {(v.primary_texts || []).length}P/{(v.headlines || []).length}H</div>)}
                  </div>
                  <span style={{ ...S.mono, fontSize: 11.5, padding: "2px 9px", borderRadius: 999, background: "#ede9fe", color: "#7c3aed", whiteSpace: "nowrap" }}>
                    → {plannedFor(v)} {plannedFor(v) === 1 ? "reklama" : "reklamy"}</span>
                </div>)
            })}
            <div style={{ background: "var(--bg-subtle,#f9fafb)", borderRadius: 10, padding: "10px 13px", fontSize: 12.5, color: "#6b7280", marginTop: 10 }}>
              Vytvoří se <b style={{ color: "#111827" }}>{totalPlanned} reklam</b>, všechny <b>⏸ PAUSED</b> — 1:1 + 9:16 podle placementu + <b>všechny primary texty a headliny</b> + vylepšení kreativy.</div>
          </>)}

          {job && (
            <div style={{ marginTop: 12 }}>
              {(job.steps || []).map((s: any) => (
                <div key={s.key} style={{ display: "flex", gap: 9, alignItems: "baseline", padding: "4px 0", fontSize: 12.5 }}>
                  <span style={{ ...S.mono, fontSize: 11, padding: "2px 9px", borderRadius: 999, flexShrink: 0,
                    background: s.status === "done" ? "#dcfce7" : s.status === "running" ? "#fef3c7" : s.status === "failed" ? "#fee2e2" : "var(--bg-subtle,#f3f4f6)",
                    color: s.status === "done" ? "#15803d" : s.status === "running" ? "#b45309" : s.status === "failed" ? "#b91c1c" : "#6b7280" }}>
                    {s.status === "done" ? "✓" : s.status === "running" ? "⏳" : s.status === "failed" ? "❌" : "·"}</span>
                  <span style={{ overflowWrap: "anywhere" }}>{s.label}{s.detail ? <span style={{ color: "#6b7280" }}> — {s.detail}</span> : ""}</span>
                </div>))}
              {jobFinished && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 650, color: failedSteps.length ? "#b45309" : okSteps.length ? "#15803d" : "#b91c1c" }}>
                    {failedSteps.length
                      ? `⚠️ Hotovo s chybami — ${okSteps.length}× vytvořeno, ${failedSteps.length}× selhalo`
                      : okSteps.length
                        ? "✅ Dávka dokončena — zkontroluj a zapni v Ads Manageru"
                        : `❌ ${job.error || "dávka selhala"}`}</div>
                  {failedSteps.length > 0 && (
                    <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 5, lineHeight: 1.5 }}>
                      Výběr v knihovně zůstává zaškrtnutý — po opravě příčiny můžeš poslat znovu rovnou odsud,
                      bez opětovného naklikávání karet.</div>)}
                </div>)}
            </div>)}
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-base,#fff)" }}>
          <button style={S.btn} onClick={() => onClose(cleanRun)}>Zavřít</button>
          {jobFinished && failedSteps.length > 0 && (
            <>
              <button style={S.btn} disabled={starting}
                onClick={() => { setJobId(null); start() }}>
                {starting ? "…" : `🔁 Znovu všech ${rows.length}`}</button>
              <button style={S.btnPri} disabled={starting}
                onClick={() => { setJobId(null); start(failedCardIds) }}>
                {starting ? "Spouštím…" : `🔁 Znovu jen neúspěšné (${failedCardIds.length})`}</button>
            </>)}
          {target && !jobId && (() => {
            const blocked = target.can_advertise === false
            return (
              <button style={blocked ? { ...S.btnPri, opacity: .4, cursor: "not-allowed" } : S.btnPri}
                disabled={starting || blocked} onClick={() => start()}>
                {blocked ? "⛔ Účet nemá oprávnění ADVERTISE" : starting ? "Spouštím…" : `🚀 Vytvořit ${totalPlanned} PAUSED reklam`}</button>)
          })()}
        </div>
      </div>
    </div>)
}

/* ═══ Meta modal ═══ */
function MetaModal({ m, onClose }: any) {
  // a source card with language versions opens a version picker — sending the
  // NL parent into a SK account (wrong texts, no swapped cover) was too easy
  const versions = [m.creative, ...(m.kids || [])]
  const [selId, setSelId] = useState(m.creative.id)
  const a = versions.find((v: any) => v.id === selId) || m.creative
  const accountsQ = useQuery({ queryKey: ["ads-accounts"], queryFn: () => sdk.client.fetch("/admin/ads-library/accounts", { method: "GET" }) })
  const [account, setAccount] = useState("")
  const [campaign, setCampaign] = useState<any>(null)
  const [adset, setAdset] = useState<any>(null)
  const [newSet, setNewSet] = useState(false)
  const [newName, setNewName] = useState(`${a.name} — Broad`)
  const [newBudget, setNewBudget] = useState(20)
  const [copyFrom, setCopyFrom] = useState("")
  const [quickAdset, setQuickAdset] = useState("")
  const [pageId, setPageId] = useState("")
  const [result, setResult] = useState<any>(null)
  const pagesQ = useQuery({
    queryKey: ["ads-meta-pages", account],
    queryFn: () => sdk.client.fetch(
      `/admin/ads-library/meta/pages${account ? `?account=${encodeURIComponent(account)}` : ""}`, { method: "GET" }),
  })

  const campsQ = useQuery({
    queryKey: ["ads-meta-camps", account],
    enabled: !!account,
    queryFn: () => sdk.client.fetch(`/admin/ads-library/meta/campaigns?account=${account}`, { method: "GET" }),
  })
  const send = useMutation({
    mutationFn: () => sdk.client.fetch(`/admin/ads-library/creatives/${a.id}/send-to-meta`, {
      method: "POST",
      body: quickAdset.trim()
        ? { adset_id: quickAdset.trim(), ...(pageId ? { page_id: pageId } : {}) } // account is resolved from the ad set
        : {
            account_id: account, campaign_id: campaign?.id,
            ...(pageId ? { page_id: pageId } : {}),
            ...(newSet
              ? { new_adset: { name: newName, daily_budget_eur: newBudget, copy_from_adset_id: copyFrom } }
              : { adset_id: adset?.id }),
          },
    }),
    onSuccess: (r: any) => setResult(r),
  })

  const pick = (on: boolean): any => ({ border: "1.5px solid", borderRadius: 10, padding: "10px 13px", marginBottom: 8, cursor: "pointer", display: "flex", gap: 10, alignItems: "center", fontSize: 13.5, borderColor: on ? "#7c3aed" : "var(--border-base,#e5e7eb)", background: on ? "#ede9fe" : "transparent" })

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "4vh 16px" }}
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{ ...S.card, maxWidth: 580, width: "100%", maxHeight: "90vh", overflow: "auto", background: "var(--bg-base,#fff)" }}>
        <div style={{ padding: "14px 18px", borderBottom: "1px solid #e5e7eb", display: "flex", position: "sticky", top: 0, background: "var(--bg-base,#fff)", zIndex: 2 }}>
          <b style={{ fontSize: 15.5 }}>🚀 Do Meta účtu — {a.name}</b>
          <button style={{ ...S.btn, border: "none", marginLeft: "auto" }} onClick={onClose}>✕</button>
        </div>
        <div style={{ padding: "16px 18px" }}>
          {result ? (
            <div>
              <div style={{ fontSize: 15, fontWeight: 650, marginBottom: 8 }}>✅ Reklama vytvořena jako PAUSED</div>
              {result.adset_name && <div style={{ fontSize: 13.5, marginBottom: 6 }}>
                📁 {result.campaign_name ? `${result.campaign_name} → ` : ""}<b>{result.adset_name}</b></div>}
              {result.texts_sent != null && <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>
                🖼️ {result.images_sent === 2 ? "1:1 + 9:16 (placement)" : "1:1"} · ✍️ {result.texts_sent}× primary + headliny</div>}
              <div style={{ ...S.mono, fontSize: 12.5, color: "#6b7280", lineHeight: 1.8 }}>
                ad_id: {result.ad_id}<br />creative_id: {result.creative_id}<br />adset_id: {result.adset_id}</div>
              <div style={{ fontSize: 13.5, marginTop: 10 }}>Zkontroluj náhled v Ads Manageru a zapni ji tam.</div>
            </div>
          ) : (<>
            {versions.length > 1 && (
              <div style={{ marginBottom: 12 }}>
                <span style={S.eyebrow}>Kterou jazykovou verzi poslat?</span>
                <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 6 }}>
                  {versions.map((v: any) => (
                    <button key={v.id} onClick={() => setSelId(v.id)}
                      style={{ ...S.btn, ...(selId === v.id ? { borderColor: "#7c3aed", background: "#ede9fe", fontWeight: 650 } : {}) }}>
                      {PROJECTS[v.project_id]?.flag || "🌐"} {v.language}{v.id === m.creative.id && !v.translated_from_id ? " (zdroj)" : ""}</button>))}
                </div>
              </div>)}
            <div style={{ background: "var(--bg-subtle,#f3f4f6)", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: "#6b7280", marginBottom: 12 }}>
              Posílá se: <b>{a.name}</b> — {a.image_9x16_url ? "1:1 do feedu + 9:16 do Stories/Reels" : "1:1 (9:16 tato verze nemá)"} + <b>všech {(a.primary_texts || []).length}× primary a {(a.headlines || []).length}× headline</b>,
              CTA, odkaz s UTM, vylepšení kreativy (rekompozice, animace, retuš, enhance CTA).
              Vytvoří se vždy jako <b>⏸ PAUSED</b> — zapínáš ručně v Ads Manageru.</div>
            {(() => {
              const accName = (accountsQ.data?.accounts || []).find((x: any) => x.id === account)?.name || ""
              const accLang = accName.match(/\(([A-Z]{2})\)/)?.[1]
              return accLang && a.language && accLang !== a.language ? (
                <div style={{ background: "#fefce8", border: "1px solid #fde68a", borderRadius: 9, padding: "9px 12px", fontSize: 12.5, color: "#a16207", marginBottom: 12 }}>
                  ⚠️ Posíláš <b>{a.language}</b> verzi do účtu <b>{accName}</b> ({accLang}). Nechtěl jsi vybrat jinou jazykovou verzi nahoře?</div>
              ) : null
            })()}
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 650 }}>📄 FB stránka</span>
              <select style={{ ...S.input, flex: 1, minWidth: 220, width: "auto" }} value={pageId} onChange={(e) => setPageId(e.target.value)}>
                <option value="">🤖 automaticky — z reklam v cílovém ad setu</option>
                {(pagesQ.data?.pages || []).map((p: any) =>
                  <option key={p.id} value={p.id}>{p.in_use ? "★ " : ""}{p.name}{p.in_use ? " — už se v účtu používá" : ""}</option>)}
              </select>
            </div>
            <div style={{ border: "1.5px solid #7c3aed", borderRadius: 10, padding: "11px 13px", marginBottom: 14, background: "#faf5ff" }}>
              <div style={{ fontSize: 13, fontWeight: 650, marginBottom: 6 }}>⚡ Rychlá cesta — vlož Ad set ID nebo URL</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input style={{ ...S.input, ...S.mono, flex: 1 }} placeholder="ID (120211234…) nebo celá URL z Ads Manageru"
                  value={quickAdset} onChange={(e) => setQuickAdset(e.target.value)} />
                <button style={quickAdset.trim() ? S.btnPri : { ...S.btnPri, opacity: .4 }}
                  disabled={!quickAdset.trim() || send.isPending}
                  onClick={() => send.mutate()}>{send.isPending ? "…" : "🚀 Odeslat"}</button>
              </div>
              <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 5 }}>
                Účet i kampaň se dohledají z ad setu samy. Reklama vznikne PAUSED, ad set se nijak nemění.</div>
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", margin: "0 0 10px" }}>— nebo vyber proklikem —</div>
            <span style={S.eyebrow}>1 · Reklamní účet</span>
            <select style={{ ...S.input, margin: "6px 0 14px" }} value={account} onChange={(e) => { setAccount(e.target.value); setCampaign(null); setAdset(null) }}>
              <option value="">— vyber účet —</option>
              {(accountsQ.data?.accounts || []).map((ac: any) => <option key={ac.id} value={ac.id}>{ac.name}</option>)}
            </select>
            {account && (<>
              <span style={S.eyebrow}>2 · Kampaň</span>
              <div style={{ margin: "6px 0 12px" }}>
                {campsQ.isLoading && <div style={{ fontSize: 13, color: "#6b7280" }}>Načítám kampaně…</div>}
                {(campsQ.data?.campaigns || []).map((c: any) => (
                  <div key={c.id} style={pick(campaign?.id === c.id)} onClick={() => { setCampaign(c); setAdset(null); setNewSet(false) }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: c.status === "ACTIVE" ? "#15803d" : "#b45309", flexShrink: 0 }} />
                    <b>{c.name}</b>
                    <span style={{ ...S.mono, fontSize: 11.5, color: "#6b7280", marginLeft: "auto", textAlign: "right" }}>{c.status}{c.daily_budget ? <><br />{fmtEur(c.daily_budget)} / den</> : ""}</span>
                  </div>))}
              </div>
            </>)}
            {campaign && (<>
              <span style={S.eyebrow}>3 · Ad set</span>
              <div style={{ margin: "6px 0 4px" }}>
                {campaign.adsets.map((s: any) => (
                  <div key={s.id} style={pick(adset?.id === s.id)} onClick={() => { setAdset(s); setNewSet(false) }}>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: s.status === "ACTIVE" ? "#15803d" : "#b45309", flexShrink: 0 }} />
                    <b>{s.name}</b>
                    <span style={{ ...S.mono, fontSize: 11.5, color: "#6b7280", marginLeft: "auto" }}>{s.daily_budget ? fmtEur(s.daily_budget) + " / den" : ""}</span>
                  </div>))}
                <div style={pick(newSet)} onClick={() => { setNewSet(true); setAdset(null) }}>＋ <b>Vytvořit nový ad set</b></div>
              </div>
              {newSet && (
                <div style={{ border: "1.5px dashed #7c3aed", borderRadius: 10, padding: 13, background: "#faf5ff", marginBottom: 10 }}>
                  <span style={S.eyebrow}>Název</span>
                  <input style={{ ...S.input, margin: "4px 0 10px" }} value={newName} onChange={(e) => setNewName(e.target.value)} />
                  <span style={S.eyebrow}>Denní rozpočet (€)</span>
                  <input type="number" style={{ ...S.input, width: 120, margin: "4px 0 10px" }} value={newBudget} onChange={(e) => setNewBudget(+e.target.value)} />
                  <span style={S.eyebrow}>Targeting zkopírovat z (vzorový ad set)</span>
                  <select style={{ ...S.input, margin: "4px 0 4px" }} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                    <option value="">— vyber vzor —</option>
                    {(campsQ.data?.campaigns || []).flatMap((c: any) => c.adsets).map((s: any) =>
                      <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>)}
            </>)}
            {send.error && <div style={{ color: "#b91c1c", fontSize: 13, marginTop: 8 }}>Chyba: {String((send.error as any)?.message || send.error)}</div>}
          </>)}
        </div>
        <div style={{ padding: "12px 18px", borderTop: "1px solid #e5e7eb", display: "flex", gap: 8, justifyContent: "flex-end", position: "sticky", bottom: 0, background: "var(--bg-base,#fff)" }}>
          <button style={S.btn} onClick={onClose}>Zavřít</button>
          {!result && <button style={(adset || (newSet && copyFrom)) ? S.btnPri : { ...S.btnPri, opacity: .4 }}
            disabled={!(adset || (newSet && copyFrom)) || send.isPending}
            onClick={() => send.mutate()}>{send.isPending ? "Vytvářím…" : "🚀 Vytvořit PAUSED reklamu"}</button>}
        </div>
      </div>
    </div>)
}

/** Official rate of the picked model, so the cost is visible before you spend it. */
function RateHint({ models, id }: any) {
  const m = (models || []).find((x: any) => x.id === id)
  if (!m) return null
  if (m.priced === false) {
    return <span style={{ ...S.mono, fontSize: 11.5, color: "#b45309" }} title="Model není v ceníku — cena generování se nespočítá">⚠️ bez ceníku</span>
  }
  return <span style={{ ...S.mono, fontSize: 11.5, color: "#6b7280" }} title="Oficiální sazba podle ceníku poskytovatele">💰 {m.rate}</span>
}

/* ═══ Fronta ═══ */
function QueueTab({ zoom }: any) {
  const qc = useQueryClient()
  const [openJob, setOpenJob] = useState<string | null>(null)
  const [retrying, setRetrying] = useState<string | null>(null)
  const { data } = useQuery({
    queryKey: ["ads-jobs"],
    queryFn: () => sdk.client.fetch("/admin/ads-library/jobs", { method: "GET" }),
    refetchInterval: 4000,
  })
  const retryTexts = async (jobId: string) => {
    setRetrying(jobId)
    try {
      await sdk.client.fetch(`/admin/ads-library/jobs/${jobId}/retry-texts`, { method: "POST" })
      qc.invalidateQueries({ queryKey: ["ads-lib"] })
      qc.invalidateQueries({ queryKey: ["ads-studio"] })
    } catch (e: any) {
      window.alert(`Opakování selhalo: ${e?.message || e}`)
    }
    setRetrying(null)
    qc.invalidateQueries({ queryKey: ["ads-jobs"] })
  }
  const jobs = data?.jobs || []
  const stepChip = (s: any) => {
    const bg = s.status === "done" ? "#dcfce7" : s.status === "running" ? "#fef3c7" : s.status === "failed" ? "#fee2e2" : "var(--bg-subtle,#f3f4f6)"
    const col = s.status === "done" ? "#15803d" : s.status === "running" ? "#b45309" : s.status === "failed" ? "#b91c1c" : "#6b7280"
    return <span key={s.key} style={{ ...S.mono, fontSize: 11, padding: "2px 9px", borderRadius: 999, background: bg, color: col }}>
      {s.label}{s.detail ? ` ${s.detail}` : ""}{s.cost_usd ? ` · $${s.cost_usd}` : ""}</span>
  }
  return (
    <div style={{ ...S.card, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e5e7eb" }}><b>⚙️ Fronta lokalizací</b>
        <span style={{ fontSize: 12, color: "#6b7280", marginLeft: 10 }}>obnovuje se každé 4 s</span></div>
      {!jobs.length && <div style={{ padding: 24, color: "#6b7280", fontSize: 13.5 }}>Zatím žádné joby — spusť lokalizaci v 📚 Knihovně.</div>}
      {jobs.map((j: any) => (
        <div key={j.id} style={{ display: "grid", gridTemplateColumns: "auto 1fr auto", gap: 14, padding: "12px 16px", borderTop: "1px solid #f3f4f6", alignItems: "start" }}>
          {j.thumb ? (
            <img src={j.thumb} alt="" data-zoom="1"
              onMouseEnter={(e) => zoom?.show(e, j.thumb, j.source_name)} onMouseMove={zoom?.move} onMouseLeave={zoom?.hide}
              style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 9, border: "1px solid var(--border-base,#e5e7eb)", cursor: "zoom-in" }} />
          ) : (
            <div style={{ width: 64, height: 64, borderRadius: 9, background: "var(--bg-subtle,#f3f4f6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>🖼️</div>
          )}
          <div>
            <b style={{ fontSize: 13.5 }}>{j.source_name} → {PROJECTS[j.target_project]?.flag || "🌐"} {j.target_project}</b>
            <div style={{ display: "flex", gap: 6, marginTop: 5, flexWrap: "wrap" }}>{(j.steps || []).map(stepChip)}</div>
            {j.error && <div style={{ fontSize: 12, color: "#b91c1c", marginTop: 4 }}>{j.error}</div>}
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button style={{ ...S.btn, border: "none", color: "#7c3aed", padding: "3px 0", fontSize: 12.5 }}
                onClick={() => setOpenJob(openJob === j.id ? null : j.id)}>
                {openJob === j.id ? "Skrýt zadání ▴" : "📋 Zobrazit zadání (prompty, modely) ▾"}</button>
              {j.status === "failed" && (
                <button style={retrying === j.id ? { ...S.btn, opacity: .5, padding: "3px 10px", fontSize: 12.5 } : { ...S.btn, borderColor: "#7c3aed", color: "#7c3aed", fontWeight: 650, padding: "3px 10px", fontSize: 12.5 }}
                  disabled={!!retrying}
                  title="Znovu vygeneruje texty stejným promptem a modelem — obrázky zůstanou"
                  onClick={() => retryTexts(j.id)}>{retrying === j.id ? "⏳ generuji texty…" : "↻ Zkusit texty znovu"}</button>)}
            </div>
            {openJob === j.id && (
              <div style={{ marginTop: 6, padding: "10px 12px", background: "var(--bg-subtle,#f9fafb)", borderRadius: 9, border: "1px solid var(--border-base,#e5e7eb)" }}>
                <div style={{ ...S.mono, fontSize: 11.5, color: "#6b7280", marginBottom: 8 }}>
                  🖼️ {j.params?.img_model} · režim {j.params?.img_mode === "swap" ? "book swap" : "akviziční"} ·
                  {" "}{j.params?.img_count}× {(j.params?.formats || []).join(" + ")}
                  {"  |  "}✍️ {j.params?.txt_model} · {j.params?.txt_count}× překlad
                  {j.params?.cost_usd != null && <>{"  |  "}💰 celkem ≈ ${Number(j.params.cost_usd).toFixed(4)} (orientačně, in+out tokeny)</>}
                </div>
                {(j.steps || []).filter((s: any) => s.prompt).map((s: any) => (
                  <div key={s.key} style={{ marginBottom: 8 }}>
                    <div style={S.eyebrow}>{s.label}</div>
                    {s.tells?.length > 0 && (
                      <div style={{ margin: "4px 0 6px", padding: "7px 10px", background: "#fefce8", border: "1px solid #fde68a", borderRadius: 8 }}>
                        <div style={{ fontSize: 11.5, fontWeight: 650, color: "#a16207", marginBottom: 3 }}>🧬 Humanizer — nalezeno a opraveno:</div>
                        {s.tells.map((t: string, i: number) =>
                          <div key={i} style={{ fontSize: 11.5, color: "#854d0e", lineHeight: 1.45 }}>• {t}</div>)}
                      </div>)}
                    <div style={{ ...S.mono, fontSize: 11.5, lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere", marginTop: 2 }}>{s.prompt}</div>
                    {s.refs?.length > 0 && (
                      <div style={{ fontSize: 11, color: "#6b7280", marginTop: 3 }}>
                        reference: {s.refs.map((r: string, i: number) =>
                          <a key={i} href={r} target="_blank" rel="noreferrer" style={{ color: "#7c3aed", marginRight: 8 }}>
                            {i === s.refs.length - 1 && s.refs.length > 1 ? "cover knihy" : `obrázek ${i + 1}`}</a>)}
                      </div>)}
                  </div>))}
                {!(j.steps || []).some((s: any) => s.prompt) &&
                  <div style={{ fontSize: 12, color: "#6b7280" }}>Job selhal dřív, než se zadání stihlo zapsat — parametry výše.</div>}
              </div>)}
          </div>
          <span style={{ textAlign: "right", whiteSpace: "nowrap" }}>
            <span style={{ fontSize: 12.5, color: j.status === "done" ? "#15803d" : j.status === "failed" ? "#b91c1c" : "#b45309", fontWeight: 650 }}>
              {j.status === "done" ? "✅ hotovo" : j.status === "failed" ? "❌ selhalo" : j.status === "running" ? "⏳ běží" : "🕐 čeká"}</span>
            {j.params?.cost_usd != null && (
              <span style={{ ...S.mono, display: "block", fontSize: 11.5, color: "#6b7280", marginTop: 3 }}
                title="Orientační cena AI generování (vstupní + výstupní tokeny, oficiální ceníky)">
                💰 ≈ ${Number(j.params.cost_usd).toFixed(3)}</span>)}
          </span>
        </div>))}
    </div>)
}

/* ═══ Studio ═══ */
function StudioTab({ zoom }: any) {
  const qc = useQueryClient()
  const fileRef = useRef<any>(null)
  const [txtModel, setTxtModel] = useState("claude-opus-4-8")
  const [uploading, setUploading] = useState<string[]>([])
  const [proj, setProj] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<Record<string, string>>({}) // itemId -> "reframe"|"save"
  const [mode, setMode] = useState<Record<string, string>>({}) // itemId -> "acquisition"|"remarketing"
  const [histOpen, setHistOpen] = useState<Record<string, boolean>>({})
  const [err, setErr] = useState<Record<string, string>>({})

  const modelsQ = useQuery({ queryKey: ["ads-models"], queryFn: () => sdk.client.fetch("/admin/ads-library/localize", { method: "GET" }) })
  const txtModels = modelsQ.data?.text_models || []
  const itemsQ = useQuery({
    queryKey: ["ads-studio"],
    queryFn: () => sdk.client.fetch("/admin/ads-library/studio", { method: "GET" }),
    // poll while any generation runs, so results appear without a refresh
    refetchInterval: (query: any) => {
      const list = query?.state?.data?.items || []
      return list.some((it: any) => it.status === "queued" || it.status === "running") ? 3000 : false
    },
  })
  const items = itemsQ.data?.items || []
  const refresh = () => qc.invalidateQueries({ queryKey: ["ads-studio"] })

  const addFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, 5)
    for (const f of list) {
      setUploading((u) => [...u, f.name])
      try {
        const b64: string = await new Promise((ok, ko) => {
          const r = new FileReader()
          r.onload = () => ok(String(r.result).split(",")[1])
          r.onerror = ko; r.readAsDataURL(f)
        })
        await sdk.client.fetch("/admin/ads-library/studio/upload", {
          method: "POST", body: { file_name: f.name, content_type: f.type, data_b64: b64 },
        })
      } catch (e: any) { window.alert(`Upload ${f.name} selhal: ${e?.message || e}`) }
      setUploading((u) => u.filter((n) => n !== f.name))
      refresh()
    }
  }
  const generate = async (it: any) => {
    const project = proj[it.id] ?? it.project
    if (!project) return window.alert("Nejdřív vyber projekt")
    setErr((e) => ({ ...e, [it.id]: "" }))
    try {
      await sdk.client.fetch("/admin/ads-library/studio/generate", {
        method: "POST",
        body: { item_id: it.id, project_id: project, txt_model: txtModel, mode: mode[it.id] ?? it.mode ?? "acquisition" },
      })
    } catch (e: any) { setErr((p) => ({ ...p, [it.id]: e?.message || "spuštění selhalo" })) }
    refresh()
  }
  const reframe = async (it: any) => {
    setBusy((b) => ({ ...b, [it.id]: "reframe" }))
    try { await sdk.client.fetch("/admin/ads-library/studio/reframe", { method: "POST", body: { item_id: it.id } }) }
    catch (e: any) { setErr((p) => ({ ...p, [it.id]: `9:16: ${e?.message || "selhalo"}` })) }
    setBusy((b) => ({ ...b, [it.id]: "" })); refresh()
  }
  const save = async (it: any) => {
    setBusy((b) => ({ ...b, [it.id]: "save" }))
    try {
      const base = String(it.name).replace(/\.[a-z0-9]+$/i, "")
      await sdk.client.fetch("/admin/ads-library/studio/save", {
        method: "POST",
        body: {
          name: `${base}-${(PROJECTS[it.project]?.lang || it.project).toUpperCase()}`,
          project_id: it.project, image_1x1_url: it.url, image_9x16_url: it.result916?.url || null,
          primaries: it.result.primaries, headlines: it.result.headlines, job_id: it.id,
        },
      })
      qc.invalidateQueries({ queryKey: ["ads-lib"] })
    } catch (e: any) { setErr((p) => ({ ...p, [it.id]: e?.message || "uložení selhalo" })) }
    setBusy((b) => ({ ...b, [it.id]: "" })); refresh()
  }
  const removeItem = async (it: any) => {
    if (!window.confirm(`Odebrat „${it.name}" ze Studia? (karta v Knihovně, pokud existuje, zůstává)`)) return
    await sdk.client.fetch(`/admin/ads-library/studio/item/${it.id}`, { method: "DELETE" })
    refresh()
  }

  const TPL_ACQ = ["letní hlavní", "varianta B", "testimonial", "advertorial", "redakce"]
  const TPL_REM = ["nespavost", "vztek + sklad", "vina", "rozchod", "noc + sklad"]
  const running = (it: any) => it.status === "queued" || it.status === "running"
  return (
    <div style={{ ...S.card, overflow: "visible" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border-base,#e5e7eb)", display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <b>🎨 Studio</b>
        <span style={{ fontSize: 12, color: "#6b7280" }}>historie se ukládá — obrázky i generování tu po refreshi zůstávají</span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "#6b7280" }}>✍️ Model textů</span>
        <select style={{ ...S.input, width: "auto" }} value={txtModel} onChange={(e) => setTxtModel(e.target.value)}>
          {txtModels.map((m: any) => <option key={m.id} value={m.id} disabled={!m.available}>{m.label}</option>)}
        </select>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files) }}
          onClick={() => fileRef.current?.click()}
          style={{ border: "2px dashed #7c3aed", borderRadius: 12, background: "#faf5ff", padding: 24, textAlign: "center", color: "#7c3aed", fontWeight: 650, cursor: "pointer" }}>
          ⬆️ Přetáhni sem 1:1 obrázky nebo klikni pro výběr
          <div style={{ fontWeight: 400, color: "#6b7280", fontSize: 12, marginTop: 4 }}>max 5 najednou · JPG/PNG do 15 MB{uploading.length ? ` · ⏳ nahrávám ${uploading.join(", ")}` : ""}</div>
          <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }}
            onChange={(e) => { if (e.target.files) addFiles(e.target.files); e.target.value = "" }} />
        </div>
      </div>
      {items.map((it: any) => (
        <div key={it.id} style={{ borderTop: "1px solid var(--border-base,#e5e7eb)", padding: "15px 16px", display: "grid", gridTemplateColumns: "auto minmax(0,1fr)", gap: 16 }}>
          <div>
            <img src={it.url} alt="" data-zoom="1"
              onMouseEnter={(e) => zoom.show(e, it.url, it.name)} onMouseMove={zoom.move} onMouseLeave={zoom.hide}
              style={{ width: 120, height: 120, objectFit: "cover", borderRadius: 11, border: "1px solid #e5e7eb", cursor: "zoom-in" }} />
            {it.result916?.url && (
              <img src={it.result916.url} alt="" data-zoom="1"
                onMouseEnter={(e) => zoom.show(e, it.result916.url, `${it.name} 9:16`)} onMouseMove={zoom.move} onMouseLeave={zoom.hide}
                style={{ width: 68, height: 120, objectFit: "cover", borderRadius: 10, border: "2px solid #15803d", cursor: "zoom-in", marginTop: 8, display: "block" }} />)}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <b style={{ fontSize: 13.5, marginRight: "auto", overflowWrap: "anywhere" }}>{it.name}</b>
              <select style={{ ...S.input, width: "auto" }} value={proj[it.id] ?? it.project}
                onChange={(e) => setProj((p) => ({ ...p, [it.id]: e.target.value }))}>
                <option value="">— vyber projekt —</option>
                {Object.keys(PROJECTS).map((p) => <option key={p} value={p}>{PROJECTS[p].flag} {p}</option>)}
              </select>
              <div style={{ display: "inline-flex", gap: 2, background: "var(--bg-subtle,#f3f4f6)", borderRadius: 9, padding: 2 }}>
                {[["acquisition", "✍️ Akviziční"], ["remarketing", "🔁 Remarketing"]].map(([m, label]) => {
                  const on = (mode[it.id] ?? it.mode ?? "acquisition") === m
                  return (
                    <button key={m} onClick={() => setMode((p) => ({ ...p, [it.id]: m }))}
                      title={m === "remarketing" ? "Šablony pro návštěvníky, co už web viděli" : "Šablony pro nové publikum"}
                      style={{ fontSize: 12, padding: "5px 10px", borderRadius: 7, border: "none", cursor: "pointer",
                        background: on ? "var(--bg-base,#fff)" : "transparent", fontWeight: on ? 650 : 400,
                        color: on ? "#7c3aed" : "#6b7280", boxShadow: on ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>
                      {label}</button>)
                })}
              </div>
              <button style={!running(it) && (proj[it.id] ?? it.project) ? S.btnPri : { ...S.btnPri, opacity: .4 }}
                disabled={running(it) || !(proj[it.id] ?? it.project)}
                onClick={() => generate(it)}>{running(it) ? "⏳ generuji…" : it.result || it.history?.length ? "↻ Přegenerovat texty" : "✍️ Vytvořit reklamy"}</button>
              <button style={busy[it.id] === "reframe" ? { ...S.btn, opacity: .4 } : S.btn} disabled={busy[it.id] === "reframe"}
                onClick={() => reframe(it)}>{busy[it.id] === "reframe" ? "⏳ 9:16…" : it.result916 ? "↻ 9:16 znovu" : "📐 Vytvořit 9:16"}</button>
              <button style={{ ...S.btn, borderColor: "#fecaca", color: "#b91c1c" }} onClick={() => removeItem(it)}>🗑️</button>
            </div>
            {err[it.id] && <div style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 6 }}>{err[it.id]}</div>}
            {it.status === "failed" && <div style={{ fontSize: 12.5, color: "#b91c1c", marginTop: 6 }}>Texty selhaly: {it.error}</div>}
            {running(it) && <div style={{ fontSize: 12.5, color: "#b45309", marginTop: 8 }}>⏳ Agent popisuje obrázek a píše 5 primary + 5 headlinů ze vzorů… (1–3 min, detail ve ⚙️ Frontě)</div>}
            {it.result && (
              <div style={{ marginTop: 10, background: "var(--bg-subtle,#f9fafb)", border: "1px solid var(--border-base,#e5e7eb)", borderRadius: 11, padding: "10px 13px" }}>
                <div style={S.eyebrow}>5× primary — {PROJECTS[it.project]?.flag} {it.project} · {it.mode === "remarketing" ? "🔁 remarketing" : "✍️ akviziční"} · {it.txt_model}</div>
                {it.result.primaries.map((p: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "2px 0", fontSize: 12.5 }}>
                    <b style={{ ...S.mono, fontSize: 10.5, color: "#6b7280", flexShrink: 0 }}>P{i + 1}</b>
                    <span style={{ fontSize: 10.5, color: "#7c3aed", background: "#ede9fe", borderRadius: 999, padding: "1px 8px", flexShrink: 0 }}>{(it.mode === "remarketing" ? TPL_REM : TPL_ACQ)[i] || "vzor"}</span>
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p}</span>
                  </div>))}
                <div style={{ ...S.eyebrow, marginTop: 8 }}>5× headline — každý jinou formulí</div>
                {it.result.headlines.map((h: string, i: number) => (
                  <div key={i} style={{ display: "flex", gap: 8, alignItems: "baseline", padding: "2px 0", fontSize: 12.5 }}>
                    <b style={{ ...S.mono, fontSize: 10.5, color: "#6b7280", flexShrink: 0 }}>H{i + 1}</b>
                    {it.result.formulas?.[i] && <span style={{ fontSize: 10.5, color: "#7c3aed", background: "#ede9fe", borderRadius: 999, padding: "1px 8px", flexShrink: 0 }}>{it.result.formulas[i]}</span>}
                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{h}</span>
                    <span style={{ ...S.mono, fontSize: 10, color: h.length > 40 ? "#b91c1c" : "#9ca3af", flexShrink: 0, marginLeft: "auto" }}>{h.length}</span>
                  </div>))}
                <div style={{ fontSize: 11.5, color: "#6b7280", marginTop: 7 }}>
                  🧬 {it.result.tells?.length ? `${it.result.tells.length} oprav humanizeru` : "čisté"}{it.cost != null ? ` · 💰 ≈ $${it.cost}` : ""}{it.result916?.cost_usd != null ? ` + 9:16 $${it.result916.cost_usd}` : ""}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
                  {it.saved_name
                    ? <span style={{ fontSize: 13, color: "#15803d", fontWeight: 650 }}>📚 v Knihovně jako „{it.saved_name}"</span>
                    : <button style={{ ...S.btn, borderColor: "#15803d", color: "#15803d", fontWeight: 650 }} disabled={busy[it.id] === "save"}
                        onClick={() => save(it)}>{busy[it.id] === "save" ? "…" : "➕ Přidat do Knihovny"}</button>}
                </div>
              </div>)}
            {it.history?.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <button style={{ ...S.btn, border: "none", color: "#7c3aed", padding: "3px 0", fontSize: 12.5 }}
                  onClick={() => setHistOpen((h) => ({ ...h, [it.id]: !h[it.id] }))}>
                  🕘 Historie generování ({it.history.length}) {histOpen[it.id] ? "▴" : "▾"}</button>
                {histOpen[it.id] && it.history.slice().reverse().map((h: any, i: number) => (
                  <div key={i} style={{ marginTop: 6, padding: "8px 11px", background: "var(--bg-subtle,#f9fafb)", border: "1px dashed var(--border-base,#e5e7eb)", borderRadius: 9, fontSize: 12 }}>
                    <div style={{ ...S.mono, fontSize: 11, color: "#6b7280", marginBottom: 3 }}>
                      {h.at} · {PROJECTS[h.project]?.flag} {h.project} · {h.txt_model}{h.cost_usd != null ? ` · $${h.cost_usd}` : ""}</div>
                    {(h.headlines || []).slice(0, 2).map((x: string, k: number) =>
                      <div key={k} style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#6b7280" }}>H{k + 1}: {x}</div>)}
                    <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#6b7280" }}>P1: {(h.primaries || [])[0]}</div>
                  </div>))}
              </div>)}
          </div>
        </div>))}
      {!items.length && !uploading.length && <div style={{ padding: "0 16px 18px", color: "#6b7280", fontSize: 13 }}>Zatím žádné obrázky — začni přetažením nahoru.</div>}
    </div>)
}

/* ═══ Výkon ═══ */
function PerformanceTab({ zoom }: any) {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string[]>([])
  const [range, setRange] = useState("7d")
  const [sort, setSort] = useState("roas")
  const [importing, setImporting] = useState<string | null>(null)
  const [importFor, setImportFor] = useState<any>(null)

  const accountsQ = useQuery({ queryKey: ["ads-accounts"], queryFn: () => sdk.client.fetch("/admin/ads-library/accounts", { method: "GET" }) })
  const accounts = accountsQ.data?.accounts || []
  const perfQ = useQuery({
    queryKey: ["ads-perf", selected.join(","), range, sort],
    enabled: selected.length > 0,
    queryFn: () => sdk.client.fetch(`/admin/ads-library/performance?accounts=${selected.join(",")}&range=${range}&sort=${sort}&limit=40`, { method: "GET" }),
  })
  const doImport = async (row: any, projectId: string) => {
    setImporting(row.ad_id); setImportFor(null)
    try {
      await sdk.client.fetch("/admin/ads-library/import", {
        method: "POST",
        body: { meta_ad_id: row.ad_id, account_id: row.account_id, project_id: projectId, language: PROJECTS[projectId]?.lang || "NL", range },
      })
      qc.invalidateQueries({ queryKey: ["ads-perf"] }); qc.invalidateQueries({ queryKey: ["ads-lib"] })
    } finally { setImporting(null) }
  }
  return (
    <div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
        {accountsQ.isLoading && <span style={{ fontSize: 13, color: "#6b7280" }}>Načítám účty…</span>}
        {accounts.map((ac: any) => (
          <button key={ac.id} onClick={() => setSelected((s) => s.includes(ac.id) ? s.filter((x) => x !== ac.id) : [...s, ac.id])}
            style={{ ...S.btn, ...(selected.includes(ac.id) ? { borderColor: "#7c3aed", background: "#ede9fe", fontWeight: 650 } : {}) }}>
            {selected.includes(ac.id) ? "✓ " : ""}{ac.name}</button>))}
      </div>
      <div style={{ display: "flex", gap: 4, marginBottom: 14, flexWrap: "wrap" }}>
        {RANGES.map(([k, label]) => (
          <button key={k} onClick={() => setRange(k)} style={{ ...S.btn, ...(range === k ? { background: "#111827", color: "#fff", borderColor: "#111827" } : {}) }}>{label}</button>))}
        <span style={{ width: 14 }} />
        {[["roas", "ROAS"], ["sales", "Prodeje"], ["ctr", "CTR"], ["spend", "Spend"]].map(([k, label]) => (
          <button key={k} onClick={() => setSort(k)} style={{ ...S.btn, ...(sort === k ? { borderColor: "#7c3aed", color: "#7c3aed", fontWeight: 650 } : {}) }}>↓ {label}</button>))}
      </div>
      {!selected.length && <div style={{ ...S.card, padding: 30, textAlign: "center", color: "#6b7280" }}>☝️ Vyber reklamní účty.</div>}
      {perfQ.isFetching && <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>Tahám živá data z Meta API…</div>}
      {perfQ.data?.rows?.length > 0 && (
        <div style={{ ...S.card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13.5 }}>
              <thead><tr style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".06em", color: "#6b7280" }}>
                <th style={{ textAlign: "left", padding: "9px 14px" }}>Reklama</th>
                <th style={{ textAlign: "left", padding: "9px 8px" }}>Účet</th>
                <th style={{ textAlign: "right", padding: "9px 8px" }}>Spend</th>
                <th style={{ textAlign: "right", padding: "9px 8px" }}>Prodeje</th>
                <th style={{ textAlign: "right", padding: "9px 8px" }}>CPA</th>
                <th style={{ textAlign: "right", padding: "9px 8px" }}>ROAS</th>
                <th style={{ textAlign: "right", padding: "9px 8px" }}>CTR</th>
                <th style={{ padding: "9px 14px" }} /></tr></thead>
              <tbody>
                {perfQ.data.rows.map((r: any) => (
                  <tr key={r.ad_id} style={{ borderTop: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 14px", maxWidth: 340 }}>
                      <div style={{ display: "flex", gap: 9, alignItems: "center" }}>
                        {r.thumb
                          ? <img src={r.thumb} alt="" data-zoom="1" onMouseEnter={(e) => zoom.show(e, r.full || r.thumb, r.ad_name)} onMouseMove={zoom.move} onMouseLeave={zoom.hide}
                              style={{ width: 38, height: 38, borderRadius: 7, objectFit: "cover", flexShrink: 0, cursor: "zoom-in" }} />
                          : <span style={{ width: 38, height: 38, borderRadius: 7, background: "#f3f4f6", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>🖼️</span>}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 550 }}>{r.ad_name}</div>
                          <div style={{ fontSize: 11.5, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.campaign_name}</div>
                        </div></div></td>
                    <td style={{ padding: "8px 8px", fontSize: 12.5, color: "#6b7280", whiteSpace: "nowrap" }}>{r.account_name}</td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "8px 8px" }}>{fmtEur(r.spend)}</td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "8px 8px" }}>{r.sales}</td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "8px 8px" }}>{r.cpa ? r.cpa.toFixed(1) + " €" : "—"}</td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "8px 8px", fontWeight: 700, color: r.roas >= 2 ? "#15803d" : r.roas >= 1.3 ? "#b45309" : "#b91c1c" }}>{r.roas ? r.roas.toFixed(2) + "×" : "—"}</td>
                    <td style={{ ...S.mono, textAlign: "right", padding: "8px 8px" }}>{r.ctr ? r.ctr.toFixed(2) + " %" : "—"}</td>
                    <td style={{ padding: "8px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {r.in_library
                        ? <span style={{ fontSize: 11.5, color: "#15803d", fontWeight: 650 }}>v knihovně ✓</span>
                        : importFor?.ad_id === r.ad_id
                          ? <select autoFocus style={{ ...S.input, fontSize: 12.5, width: "auto" }} defaultValue=""
                              onChange={(e) => e.target.value && doImport(r, e.target.value)} onBlur={() => setImportFor(null)}>
                              <option value="" disabled>Projekt…</option>
                              {Object.entries(PROJECTS).map(([k, v]) => <option key={k} value={k}>{v.flag} {k}</option>)}
                            </select>
                          : <button style={S.btn} disabled={importing === r.ad_id} onClick={() => setImportFor(r)}>
                              {importing === r.ad_id ? "Importuji…" : "＋ do knihovny"}</button>}</td>
                  </tr>))}
              </tbody>
            </table>
          </div>
        </div>)}
    </div>)
}

/* ═══ Shell ═══ */
const AdsLibraryPage = () => {
  const [tab, setTab] = useState<"lib" | "perf" | "queue" | "studio">("lib")
  const zoom = useZoom()
  return (
    <div style={{ padding: "20px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
        <h1 style={{ fontSize: 19, fontWeight: 700, margin: 0 }}>🗂️ Knihovna reklam</h1>
        <div style={{ display: "flex", gap: 2, background: "var(--bg-subtle,#f3f4f6)", borderRadius: 10, padding: 3 }}>
          {[["lib", "📚 Knihovna"], ["perf", "🏆 Výkon"], ["queue", "⚙️ Fronta"], ["studio", "🎨 Studio"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k as any)}
              style={{ fontSize: 13.5, padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer",
                background: tab === k ? "var(--bg-base,#fff)" : "transparent", fontWeight: tab === k ? 650 : 400,
                boxShadow: tab === k ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>{label}</button>))}
        </div>
      </div>
      {tab === "lib" && <LibraryTab zoom={zoom} />}
      {tab === "perf" && <PerformanceTab zoom={zoom} />}
      {tab === "queue" && <QueueTab zoom={zoom} />}
      {tab === "studio" && <StudioTab zoom={zoom} />}
      {zoom.el}
    </div>)
}

export const config = defineRouteConfig({ label: "Knihovna reklam" })
export default AdsLibraryPage
