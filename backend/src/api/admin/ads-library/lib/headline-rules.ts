// @ts-nocheck
/**
 * Headline craft rules for Studio-generated ads.
 *
 * Sources: the 7 proven D2C headline formulas + the truncation/psychology
 * rules from "Why Your Facebook Ad Headlines Are Killing Your ROAS" (2026),
 * combined with the project's own humanizer pass.
 *
 * Examples are written in Czech as a shape reference — the model translates
 * the pattern into the target language, it does not copy the words.
 */
export const HEADLINE_FORMULAS = `HEADLINY (5×) — každý JINOU formulí z těchto sedmi (vyber 5, každou nejvýš jednou):

1. HOW-TO SLIB — „Jak [výsledek] bez [bolesti]"
   př. „Jak pustit minulost bez terapie" · „Jak zastavit myšlenky bez meditace"
2. PŘÍMÁ OTÁZKA — nutí čtenáře v duchu odpovědět „ano"
   př. „Nespíš kvůli tomu, co bylo?" · „Vracíš se pořád k jedné hádce?"
3. SOCIÁLNÍ DŮKAZ — objem, hodnocení, „lidé jako ty"
   př. „9 z 10 to nosí v sobě" · „Přečetlo 40 000 lidí"
4. NEGATIVNÍ ÚHEL — pojmenuj chybu, kterou člověk dělá (o sobě, ne o čtenáři)
   př. „Přestal jsem to v sobě dusit" · „Čekat, až to přejde, nefunguje"
5. IF/THEN KVALIFIKACE — okamžitě vytřídí správné publikum
   př. „Když ti to nedá spát, čti tohle" · „Máš psa, co netáhne? Tohle pomohlo"
6. CENA / NABÍDKA — jen pravdivá, konkrétní čísla
   př. „Tento týden za 749 Kč" · „2 e-knihy zdarma k tomu"
7. SROVNÁNÍ — vymez se vůči známé alternativě
   př. „Ne další kniha o pozitivním myšlení" · „Proč mi terapie nestačila"

PRAVIDLA PSANÍ HEADLINŮ (z výkonnostních dat FB reklam):
- DÉLKA: 25–40 znaků včetně emoji. Přes 40 se na mobilu ořízne třemi tečkami — a 98 % lidí je na mobilu.
- FRONT-LOAD: prvních pět slov musí nést celý smysl. Když se zbytek usekne, věta pořád dává smysl.
- HEADLINE PRODÁVÁ KLIK, NE KNIHU. Doplňuje vizuál o kontext — neopakuje, co už je na obrázku vidět.
- NEOPAKUJ PRIMARY: headline nesmí říct totéž co úvod svého primary textu. Přidej jiný úhel.
- SLOVESO PŘED POPISKEM: „Přečti to za tři dny" táhne víc než „Nová kniha o pouštění".
- KONKRÉTNO PŘED VÁGNEM: číslo, detail, situace. Ne „Změň svůj život", ale „Poprvé za rok jsem usnul".
- EMOJI: nejvýš jedno, na začátku, a jen když k obsahu sedí.
- ZÁKAZ (Meta policy): nikdy výrok o čtenáři osobně („Tvoje manželství je v troskách", „Jsi na dně")
  ani nereálný slib („Zhubneš za 3 dny"). Mluv o SOBĚ jako vypravěč, ne o čtenáři.`

/**
 * Headline-specific humanizer block. The generic humanizer targets prose —
 * on a 40-char punch most of its rules either don't apply or actively hurt
 * (emoji and Czech/Polish quotes are correct here, clipped fragments are the
 * point). This narrows it to what actually shows up in ad headlines.
 */
export const HEADLINE_HUMANIZER = `HEADLINY kontroluj JINAK než primary texty — jsou to údery, ne próza.

HLEDEJ A OPRAV:
- trojice pro efekt („klid, radost a svoboda") → nech jednu věc
- „není to X, je to Y" a přilepené negace na konci
- prázdná superlativa: převratný, výjimečný, jedinečný, dokonalý
- AI fráze: odemkni svůj potenciál, transformuj svůj život, cesta k sobě, objev sílu v sobě
- falešné rozsahy: „od úzkosti k vnitřnímu klidu"
- vágní sliby („Změň svůj život") → nahraď konkrétní situací nebo číslem
- změkčovadla („může ti pomoci", „snad ti to dá") → tvrď to přímo
- opisy místo prostého slovesa („kniha, která představuje…") → „kniha o tom, jak…"

NECH BÝT — u facebookových headlinů je tohle správně, NENÍ to stopa po AI:
- jeden emoji na začátku
- české/polské/maďarské uvozovky „…"
- neúplné věty a úsečné údery („Zimne. Nietknięte.")
- ich-forma, osobní zpověď vypravěče

TVRDÉ LIMITY PŘI PŘEPISU:
- výsledek musí zůstat do 40 znaků včetně emoji; když se ti to nevejde, RADĚJI NECH PŮVODNÍ
- zachovej formuli headlinu (otázka zůstane otázkou, sociální důkaz zůstane důkazem)
- headline nesmí začít opakovat myšlenku svého primary textu`

/** Hard cap Meta truncates at on mobile. */
export const HEADLINE_MAX = 40
