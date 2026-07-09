// @ts-nocheck
import Anthropic from "@anthropic-ai/sdk"

/**
 * Gender + vocative resolver for gender-aware marketing emails.
 *
 * Given a first name we resolve:
 *   - gender:   "m" | "f" | "unknown"   (which copy variant to serve)
 *   - vocative: the name in the Czech 5th case for direct address
 *               ("Jana" -> "Jano", "Petr" -> "Petře", "Tomáš" -> "Tomáši")
 *
 * Primary path = a cheap Haiku call (handles foreign / unusual names well).
 * Fallback = a rule-based heuristic on name endings (used when the AI key is
 * missing or the call fails). The resolver NEVER throws — worst case it returns
 * { gender: "unknown", vocative: <name as-is> }.
 *
 * Resolution runs ONCE per contact (at signup, or lazily on first send) and the
 * result is persisted on marketing_contact.{gender,vocative}.
 */

export type GenderVocative = { gender: "m" | "f" | "unknown"; vocative: string }

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

// Female names ending in a consonant (no -a/-e) — small but common set.
const FEM_CONSONANT = new Set([
  "dagmar", "ester", "miriam", "ingrid", "karin", "karen", "nikol", "rut",
  "ruth", "doris", "carmen", "sharon", "ann", "lilian", "vivian", "mirjam",
])

/** Rule-based fallback for CZECH name-ending heuristics. ~95% on local names. */
export function ruleFallbackCs(firstNameRaw) {
  const raw = String(firstNameRaw || "").trim().split(/\s+/)[0] || ""
  if (!raw) return { gender: "unknown", vocative: "" }
  const name = cap(raw)
  const l = name.toLowerCase()

  let gender = "unknown"
  if (l.endsWith("a")) gender = "f"
  else if (/(ie|ce|le|ne|re|se|te)$/.test(l)) gender = "f" // Marie, Lucie, Alice...
  else if (FEM_CONSONANT.has(l)) gender = "f"
  else gender = "m" // consonant ending → assume male

  let voc = name
  if (gender === "f") {
    if (l.endsWith("a")) voc = name.slice(0, -1) + "o" // Jana→Jano, Eva→Evo
    else voc = name // Marie, Lucie, Dagmar → unchanged
  } else if (gender === "m") {
    if (/[aeiouyíý]$/i.test(name)) voc = name // Hugo, Jiří, Ivo → unchanged
    else if (l.endsWith("ek")) voc = name.slice(0, -2) + "ku" // Marek→Marku
    else if (/(ch)$/i.test(l)) voc = name + "u"
    else if (/[kgh]$/i.test(name)) voc = name + "u" // Patrik→Patriku, Oleg→Olegu
    else if (l.endsWith("r")) voc = name.slice(0, -1) + "ře" // Petr→Petře
    else if (/[šžčřcjťďň]$/i.test(name)) voc = name + "i" // Tomáš→Tomáši, Ondřej→Ondřeji
    else voc = name + "e" // David→Davide, Roman→Romane
  }
  return { gender, vocative: voc }
}

/** Rule-based fallback for POLISH wołacz (5th case). ~90% on local names. */
export function ruleFallbackPl(firstNameRaw) {
  const raw = String(firstNameRaw || "").trim().split(/\s+/)[0] || ""
  if (!raw) return { gender: "unknown", vocative: "" }
  const name = cap(raw)
  const l = name.toLowerCase()

  let gender = l.endsWith("a") ? "f" : "m"

  let voc = name
  if (gender === "f") {
    if (/(sia|cia|nia|zia|dzia)$/.test(l)) voc = name.slice(0, -1) + "u" // Kasia→Kasiu, Ania→Aniu
    else if (l.endsWith("a")) voc = name.slice(0, -1) + "o" // Anna→Anno, Ewa→Ewo, Maria→Mario
  } else {
    if (/[aeiouyąęó]$/i.test(name)) voc = name // Bruno, Jerzy, Antoni → beze změny
    else if (l.endsWith("ek")) voc = name.slice(0, -2) + "ku" // Marek→Marku, Bartek→Bartku
    else if (l.endsWith("eł")) voc = name.slice(0, -2) + "le" // Paweł→Pawle
    else if (l.endsWith("ł")) voc = name.slice(0, -1) + "le" // Michał→Michale
    else if (/(sz|cz|rz|dz|ż|c|j)$/.test(l)) voc = name + "u" // Tomasz→Tomaszu, Andrzej→Andrzeju
    else if (/[kgh]$/i.test(name) || l.endsWith("ch")) voc = name + "u" // Ludwik→Ludwiku, Wojciech→Wojciechu
    else if (l.endsWith("r")) voc = name.slice(0, -1) + "rze" // Piotr→Piotrze
    else voc = name + "ie" // Jan→Janie, Adam→Adamie, Krzysztof→Krzysztofie
  }
  return { gender, vocative: voc }
}

/** Rule-based fallback for SLOVAK. Modern Slovak has no vocative — address by
 *  nominative ("Ahoj Jana", "Ahoj Peter"), so vocative = name unchanged.
 *  Gender heuristic mirrors Czech endings (~95% on SK names). */
export function ruleFallbackSk(firstNameRaw) {
  const raw = String(firstNameRaw || "").trim().split(/\s+/)[0] || ""
  if (!raw) return { gender: "unknown", vocative: "" }
  const name = cap(raw)
  const l = name.toLowerCase()

  let gender = "unknown"
  if (l.endsWith("a")) gender = "f"
  else if (/(ie|ce|le|ne|re|se|te)$/.test(l)) gender = "f" // Mária→(-ia je "a"), Lucie, Alice…
  else if (FEM_CONSONANT.has(l)) gender = "f"
  else gender = "m"

  return { gender, vocative: name } // nominative address
}

/** Locale-aware fallback dispatcher. Defaults to Czech. */
export function ruleFallback(firstNameRaw, locale = "cs") {
  const loc = String(locale || "").toLowerCase()
  if (loc.startsWith("pl")) return ruleFallbackPl(firstNameRaw)
  if (loc.startsWith("sk")) return ruleFallbackSk(firstNameRaw)
  return ruleFallbackCs(firstNameRaw)
}

/** Primary resolver: Haiku with rule-based fallback. Never throws. */
export async function resolveGenderVocative(firstNameRaw, locale = "cs") {
  const raw = String(firstNameRaw || "").trim().split(/\s+/)[0] || ""
  if (!raw) return { gender: "unknown", vocative: "" }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return ruleFallback(raw, locale)

  const loc = String(locale || "").toLowerCase()
  const isPl = loc.startsWith("pl")
  const isSk = loc.startsWith("sk")
  const system = isSk
    ? "Si expert na slovenčinu. Pre dané krstné meno urč gramatický rod. Slovenčina nemá vokatív — oslovuje sa nominatívom, takže vocative = meno bez zmeny. Odpovedz IBA JSON, nič viac."
    : isPl
    ? "Jesteś ekspertem od języka polskiego. Dla podanego imienia określ rodzaj gramatyczny i wołacz (5. przypadek). Odpowiedz TYLKO w formacie JSON, nic więcej."
    : "Jsi expert na češtinu. Pro dané křestní jméno urči gramatický rod a 5. pád (vokativ). Odpověz POUZE JSON, nic víc."
  const userPrompt = isSk
    ? `Meno: "${raw}"\n` +
      `Vráť presne: {"gender":"m"|"f"|"unknown","vocative":"<meno bez zmeny>"}\n` +
      `Pravidlá: "m" mužské meno, "f" ženské, "unknown" keď sa nedá určiť (cudzie/unisex). ` +
      `vocative = meno v nominatíve bez zmeny (Jana→Jana, Peter→Peter, Zuzana→Zuzana). Žiadny iný text než JSON.`
    : isPl
    ? `Imię: "${raw}"\n` +
      `Zwróć dokładnie: {"gender":"m"|"f"|"unknown","vocative":"<imię w wołaczu>"}\n` +
      `Zasady: "m" imię męskie, "f" żeńskie, "unknown" gdy nie można określić (obce/uniseks). ` +
      `vocative = forma w wołaczu (Anna→Anno, Ewa→Ewo, Kasia→Kasiu, Maria→Mario, Jan→Janie, Piotr→Piotrze, Tomasz→Tomaszu, Marek→Marku, Paweł→Pawle, Łukasz→Łukaszu). ` +
      `Dla obcych/nieznanych imion zwróć vocative = imię bez zmian. Żadnego innego tekstu poza JSON.`
    : `Jméno: "${raw}"\n` +
      `Vrať přesně: {"gender":"m"|"f"|"unknown","vocative":"<jméno v 5. pádě>"}\n` +
      `Pravidla: "m" mužské jméno, "f" ženské, "unknown" když nelze určit (cizí/unisex). ` +
      `vocative = oslovení v 5. pádě (Jana→Jano, Eva→Evo, Petr→Petře, Tomáš→Tomáši, Marek→Marku, Jiří→Jiří). ` +
      `U cizích/neznámých jmen vrať vocative = jméno beze změny. Žádný jiný text než JSON.`

  try {
    const client = new Anthropic({ apiKey })
    const model = process.env.MARKETING_GENDER_MODEL || "claude-haiku-4-5-20251001"
    const resp = await client.messages.create({
      model,
      max_tokens: 120,
      system,
      messages: [{ role: "user", content: userPrompt }],
    })
    const txt = (resp.content?.[0]?.text) || ""
    const m = txt.match(/\{[\s\S]*\}/)
    if (!m) return ruleFallback(raw, locale)
    const parsed = JSON.parse(m[0])
    const gender =
      parsed.gender === "m" || parsed.gender === "f" ? parsed.gender : "unknown"
    let vocative =
      typeof parsed.vocative === "string" && parsed.vocative.trim()
        ? parsed.vocative.trim()
        : raw
    vocative = cap(vocative)
    return { gender, vocative }
  } catch (e) {
    return ruleFallback(raw, locale)
  }
}

/**
 * Pick the gender-specific variant of an email field.
 *   - string            → returned as-is (gender-neutral / legacy flows)
 *   - { m, f }          → picks by gender; unknown / null → female (per config)
 * Female is the default for ambiguous contacts because the audience skews ~85% F.
 */
export function pickGenderVariant(val, gender) {
  if (val == null) return val
  if (typeof val === "string") return val
  const g = gender === "m" ? "m" : "f" // "f" for female, "unknown", null
  return val[g] ?? val.f ?? val.m ?? ""
}
