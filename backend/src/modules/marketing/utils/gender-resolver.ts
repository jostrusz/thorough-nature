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

// Common Hungarian male names ending in a vowel (the -a/-e heuristic below
// would misclassify them as female): Attila, Béla, Géza, Gyula, Kálmán is
// consonant but e.g. Imre, Bence, Vince end in -e.
const HU_MALE_VOWEL = new Set([
  "attila", "béla", "geza", "géza", "gyula", "imre", "bence", "vince",
  "barna", "csaba", "zsombor", "botond", "endre",
])
const HU_FEMALE = new Set([
  "emese", "enikő", "eniko", "gyöngyi", "gyongyi", "noémi", "noemi",
  "tímea", "timea", "beáta", "beata", "ágnes", "agnes", "piroska",
])

/** Rule-based fallback for HUNGARIAN. Hungarian has no vocative and no
 *  grammatical gender — address by given name unchanged ("Szia Zsófia").
 *  Gender matters only for choosing the m/f copy variant. Heuristic: most
 *  female names end in a vowel (-a/-e/-i/-ó/-ő), most male in a consonant,
 *  with a curated exception list (Attila, Imre, Bence…). */
export function ruleFallbackHu(firstNameRaw) {
  const raw = String(firstNameRaw || "").trim().split(/\s+/)[0] || ""
  if (!raw) return { gender: "unknown", vocative: "" }
  const name = cap(raw)
  const l = name.toLowerCase()

  let gender = "unknown"
  if (HU_FEMALE.has(l)) gender = "f"
  else if (HU_MALE_VOWEL.has(l)) gender = "m"
  else if (/[aáeéiíoóöőuúüű]$/i.test(l)) gender = "f"
  else gender = "m"

  return { gender, vocative: name } // nominative address
}

// Common French male names ending in -e (the vowel heuristic below would
// misread them as female). Dominique/Camille/Claude are genuinely unisex and
// stay "unknown" so the copy falls back to the female default variant.
const FR_MALE_E = new Set([
  "pierre", "alexandre", "philippe", "maxime", "jérôme", "jerome", "étienne",
  "etienne", "antoine", "baptiste", "christophe", "stéphane", "stephane",
  "jean-baptiste", "côme", "come", "auguste", "hippolyte", "timothée",
  "timothee", "barnabé", "barnabe", "ange", "brice", "blaise", "jules",
])
const FR_UNISEX = new Set(["dominique", "camille", "claude", "sacha", "alix", "morgan"])

/** Rule-based fallback for FRENCH. French has no vocative — address by the
 *  first name unchanged ("Salut Marie") — so vocative = name as-is. Gender
 *  only picks the m/f copy variant (adjective/participle agreement: prêt/
 *  prête, seul/seule, désolé/désolée). Heuristic: -e/-a endings lean female
 *  with a curated male -e list (Pierre, Maxime, Antoine…); unisex names stay
 *  unknown → female default per pickGenderVariant. */
export function ruleFallbackFr(firstNameRaw) {
  const raw = String(firstNameRaw || "").trim().split(/\s+/)[0] || ""
  if (!raw) return { gender: "unknown", vocative: "" }
  const name = cap(raw)
  const l = name.toLowerCase()

  let gender = "unknown"
  if (FR_UNISEX.has(l)) gender = "unknown"
  else if (FR_MALE_E.has(l)) gender = "m"
  else if (FEM_CONSONANT.has(l)) gender = "f"
  else if (/(ine|elle|ette|anne|enne|ie|ée|a)$/.test(l)) gender = "f"
  else if (l.endsWith("e")) gender = "f" // Sophie, Claire, Aline… (males covered above)
  else gender = "m" // consonant / -o / -i endings → assume male (Hugo, Rémi…)

  return { gender, vocative: name } // no vocative case in French
}

/** Rule-based fallback for GERMAN names. German has no vocative case, so
 *  vocative = the name unchanged; we only resolve grammatical gender for the
 *  "Liebe/Lieber" salutation and gendered copy variants. ~90% on DE names. */
const DE_MALE_VOWEL_END = new Set([
  // Common male names ending in a vowel/-e that the -a/-e heuristic would
  // otherwise misread as female. (Note: "Andrea" IS female in Germany.)
  "luca", "luka", "noah", "jonah", "jona", "elia", "josua", "joshua", "mika",
  "nikita", "ole", "uwe", "arne", "malte", "eike", "fiete", "kalle",
  "matteo", "mattheo", "timo", "nico", "niko", "leo", "theo", "milo",
  "arno", "bruno", "hugo", "ivo", "otto", "udo", "ingo", "bodo", "heiko",
  "guido", "marco", "mirko", "ali",
])
export function ruleFallbackDe(firstNameRaw) {
  const raw = String(firstNameRaw || "").trim().split(/\s+/)[0] || ""
  if (!raw) return { gender: "unknown", vocative: "" }
  const name = cap(raw)
  const l = name.toLowerCase()

  let gender = "unknown"
  if (DE_MALE_VOWEL_END.has(l)) gender = "m"
  else if (/[ae]$/.test(l)) gender = "f" // Anna, Julia, Sabine, Marie, Heike...
  else if (FEM_CONSONANT.has(l)) gender = "f" // Dagmar, Ingrid, Karin...
  else if (/(in|id|un|ud|hild|gard|trud|burg)$/.test(l)) gender = "f" // Kerstin, Sigrid...
  else gender = "m" // consonant ending → assume male (Thomas, Stefan, Jörg...)

  // No vocative case in German — address by the plain first name.
  return { gender, vocative: name }
}

/** Locale-aware fallback dispatcher. Defaults to Czech. */
export function ruleFallback(firstNameRaw, locale = "cs") {
  const loc = String(locale || "").toLowerCase()
  if (loc.startsWith("pl")) return ruleFallbackPl(firstNameRaw)
  if (loc.startsWith("sk")) return ruleFallbackSk(firstNameRaw)
  if (loc.startsWith("hu")) return ruleFallbackHu(firstNameRaw)
  if (loc.startsWith("fr")) return ruleFallbackFr(firstNameRaw)
  return ruleFallbackCs(firstNameRaw)
}

/** Rule-based fallback for GERMAN names. German has no vocative case, so
 *  vocative = the name unchanged; we only resolve grammatical gender for the
 *  "Liebe/Lieber" salutation and gendered copy variants. ~90% on DE names. */
const DE_MALE_VOWEL_END = new Set([
  // Common male names ending in a vowel/-e that the -a/-e heuristic would
  // otherwise misread as female. (Note: "Andrea" IS female in Germany.)
  "luca", "luka", "noah", "jonah", "jona", "elia", "josua", "joshua", "mika",
  "nikita", "ole", "uwe", "arne", "malte", "eike", "fiete", "kalle",
  "matteo", "mattheo", "timo", "nico", "niko", "leo", "theo", "milo",
  "arno", "bruno", "hugo", "ivo", "otto", "udo", "ingo", "bodo", "heiko",
  "guido", "marco", "mirko", "ali",
])
export function ruleFallbackDe(firstNameRaw) {
  const raw = String(firstNameRaw || "").trim().split(/\s+/)[0] || ""
  if (!raw) return { gender: "unknown", vocative: "" }
  const name = cap(raw)
  const l = name.toLowerCase()

  let gender = "unknown"
  if (DE_MALE_VOWEL_END.has(l)) gender = "m"
  else if (/[ae]$/.test(l)) gender = "f" // Anna, Julia, Sabine, Marie, Heike...
  else if (FEM_CONSONANT.has(l)) gender = "f" // Dagmar, Ingrid, Karin...
  else if (/(in|id|un|ud|hild|gard|trud|burg)$/.test(l)) gender = "f" // Kerstin, Sigrid...
  else gender = "m" // consonant ending → assume male (Thomas, Stefan, Jörg...)

  // No vocative case in German — address by the plain first name.
  return { gender, vocative: name }
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
  const isHu = loc.startsWith("hu")
  const isFr = loc.startsWith("fr")
  const system = isFr
    ? "Tu es expert de la langue française. Pour le prénom donné, détermine le genre de la personne qui le porte. Le français n'a pas de vocatif — on s'adresse par le prénom inchangé, donc vocative = le prénom tel quel. Réponds UNIQUEMENT en JSON, rien d'autre."
    : isHu
    ? "Te a magyar nyelv szakértője vagy. Az adott keresztnévhez határozd meg a viselő nemét. A magyarban nincs megszólító eset — a keresztnév változatlan marad, tehát vocative = a név változatlanul. CSAK JSON-nal válaszolj, semmi mással."
    : isSk
    ? "Si expert na slovenčinu. Pre dané krstné meno urč gramatický rod. Slovenčina nemá vokatív — oslovuje sa nominatívom, takže vocative = meno bez zmeny. Odpovedz IBA JSON, nič viac."
    : isPl
  if (loc.startsWith("de")) return ruleFallbackDe(firstNameRaw)
    ? "Jesteś ekspertem od języka polskiego. Dla podanego imienia określ rodzaj gramatyczny i wołacz (5. przypadek). Odpowiedz TYLKO w formacie JSON, nic więcej."
    : isDe
    ? "Du bist Experte für deutsche Vornamen. Bestimme für den angegebenen Vornamen das Geschlecht, wie er in Deutschland üblicherweise vergeben wird. Antworte NUR mit JSON, sonst nichts."
    : "Jsi expert na češtinu. Pro dané křestní jméno urči gramatický rod a 5. pád (vokativ). Odpověz POUZE JSON, nic víc."
  const userPrompt = isFr
    ? `Prénom : "${raw}"\n` +
      `Retourne exactement : {"gender":"m"|"f"|"unknown","vocative":"<le prénom inchangé>"}\n` +
      `Règles : "m" prénom masculin, "f" prénom féminin, "unknown" si indéterminable (étranger/épicène comme Dominique, Camille, Claude, Sacha). ` +
      `vocative = le prénom tel quel (Marie→Marie, Pierre→Pierre, Chloé→Chloé). Aucun autre texte que le JSON.`
    : isHu
    ? `Keresztnév: "${raw}"\n` +
      `Pontosan ezt add vissza: {"gender":"m"|"f"|"unknown","vocative":"<a név változatlanul>"}\n` +
      `Szabályok: "m" férfinév, "f" női név, "unknown" ha nem eldönthető (külföldi/unisex). ` +
      `vocative = a keresztnév változatlanul (Zsófia→Zsófia, Attila→Attila, Imre→Imre). A JSON-on kívül semmilyen más szöveg.`
    : isSk
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
    : isDe
    ? `Vorname: "${raw}"\n` +
      `Gib exakt zurück: {"gender":"m"|"f"|"unknown","vocative":"<Vorname unverändert>"}\n` +
      `Regeln: "m" = männlicher Vorname (Thomas, Stefan, Luca, Noah), "f" = weiblicher Vorname (Anna, Sabine, Andrea, Ingrid), ` +
      `"unknown" = nicht bestimmbar (Unisex wie Kim, Sascha/ausländisch unklar). ` +
      `Achtung: In Deutschland ist "Andrea" weiblich. Das Deutsche hat keinen Vokativ — vocative = Vorname unverändert. ` +
      `Kein anderer Text außer JSON.`
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
