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

/** Rule-based fallback. Czech name-ending heuristics. ~95% on local names. */
export function ruleFallback(firstNameRaw) {
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

/** Primary resolver: Haiku with rule-based fallback. Never throws. */
export async function resolveGenderVocative(firstNameRaw, locale = "cs") {
  const raw = String(firstNameRaw || "").trim().split(/\s+/)[0] || ""
  if (!raw) return { gender: "unknown", vocative: "" }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return ruleFallback(raw)

  try {
    const client = new Anthropic({ apiKey })
    const model = process.env.MARKETING_GENDER_MODEL || "claude-haiku-4-5-20251001"
    const resp = await client.messages.create({
      model,
      max_tokens: 120,
      system:
        "Jsi expert na češtinu. Pro dané křestní jméno urči gramatický rod a 5. pád (vokativ). Odpověz POUZE JSON, nic víc.",
      messages: [
        {
          role: "user",
          content:
            `Jméno: "${raw}"\n` +
            `Vrať přesně: {"gender":"m"|"f"|"unknown","vocative":"<jméno v 5. pádě>"}\n` +
            `Pravidla: "m" mužské jméno, "f" ženské, "unknown" když nelze určit (cizí/unisex). ` +
            `vocative = oslovení v 5. pádě (Jana→Jano, Eva→Evo, Petr→Petře, Tomáš→Tomáši, Marek→Marku, Jiří→Jiří). ` +
            `U cizích/neznámých jmen vrať vocative = jméno beze změny. Žádný jiný text než JSON.`,
        },
      ],
    })
    const txt = (resp.content?.[0]?.text) || ""
    const m = txt.match(/\{[\s\S]*\}/)
    if (!m) return ruleFallback(raw)
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
    return ruleFallback(raw)
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
