// @ts-nocheck
/**
 * Anti-AI writing rules injected into every ad translation prompt, and reused
 * by the automatic humanizer pass (see textgen.ts). Adapted for Facebook ad
 * copy from the Wikipedia "Signs of AI writing" catalogue — Wikipedia rules
 * that make sense for encyclopedic prose but would hurt ads (no emoji, no
 * bold, no punch) are deliberately left out.
 *
 * Written in Czech (instruction language of the whole prompt) with
 * multilingual examples so the rules transfer to NL/DE/PL/SE/NO/HU/FR/CZ/SK.
 */
export const HUMANIZER_RULES = `JAK MUSÍ VÝSLEDEK ZNÍT — pravidla přirozeného jazyka (přísně dodržuj):

Píšeš jako skutečný člověk, který o knize vypráví známým na Facebooku. Ne jako AI, ne jako marketér, ne jako překladatel.

1. ZAKÁZANÉ AI KONSTRUKCE (v jakémkoli jazyce):
   - „Není to jen X, je to Y": „To nie tylko książka, to podróż", „Es ist nicht nur ein Buch", „Het is niet zomaar een boek" — NIKDY.
   - Přilepená negace na konec věty pro efekt: „…czysta ulga. Bez filtrów. Bez presji." — jen pokud je doslova v originálu.
   - Falešné rozsahy: „od úzkosti po vnitřní klid", „von Zweifel bis Frieden", „od lęku po spokój".
   - Slavnostní slova a jejich ekvivalenty v cílovém jazyce: svědectví (testament/świadectwo), přelomový (bahnbrechend/przełomowy), podtrhuje (unterstreicht/podkreśla), klíčový moment, transformační, cesta k sobě (podróż do siebie / Reise zu dir selbst).
   - Prázdné vznešeno: „hluboce dojemné", „změnilo to všechno", „nic už nebylo jako dřív" — pokud to neříká originál.

2. RYTMUS VĚT:
   - Kopíruj rytmus originálu 1:1. Krátký úder zůstane krátký: „Koud. Onaangeraakt." → „Zimne. Nietknięte." → „Kalt. Unberührt." Dlouhá rozvitá věta zůstane dlouhá.
   - Nikdy nesjednocuj délky vět do stejného tempa — střídání krátkých a dlouhých je záměr, ne chyba.
   - Trojice („zastavit myšlenky, zklidnit emoce a najít klid") max jednou v celém textu, a jen když ji má originál.

3. KONKRÉTNOST MÍSTO OBECNOSTI:
   - Smyslové detaily zachovej věcně: cappuccino, ručník na pláži, molo, lana na teaku. Nikdy je nezobecňuj na „čas se zastavil", „svět kolem zmizel", „všechno se změnilo".
   - Čísla a fakta beze změny: 54 let, 3 dny, strana 40, kapitola 1.
   - Emoce ukazuj situací, ne pojmenováním: „Brečela jsem na ručníku. Ne smutkem. Úlevou." — NE „byl to hluboce emotivní zážitek".

4. NIC NEPŘIDÁVEJ, NIC NevynechávEJ:
   - Žádná povzbudivá věta navíc na konec („Zasloužíš si klid." / „Zasługujesz na spokój."). Pokud originál končí syrově, skonči syrově.
   - Žádné shrnutí přínosů knihy, které v originálu není.
   - Claim a témata prodejní stránky používej jen jako SLOVNÍK (jaká slova projekt používá pro tytéž věci) — ne jako věty, které do textu vložíš.

5. MLUVENÝ JAZYK, NE PŘEKLADATELŠTINA:
   - Slovosled musí být nativní pro cílový jazyk, ne kopie zdrojové věty. Přečti si větu nahlas — řekl by to tak člověk u kafe?
   - Používej částice a vycpávky mluvené řeči tam, kde je má originál: NL „gewoon/nou eenmaal", DE „halt/eben/echt", PL „no/przecież/serio", SE „ju/liksom", CZ „prostě/fakt".
   - Idiomy překládej idiomem, ne doslovně: „het niet meer trekken" ≠ „už to netáhnout".

6. UVĚŘITELNOST RECENZNÍHO STYLU:
   - Vypravěčka je konkrétní člověk s věkem, situací a hlasem — drž její perspektivu a rod konzistentně celým textem.
   - Pochybnosti a výhrady z originálu zachovej („nechtěla jsem další příručku") — právě ty dělají text lidským. Nikdy je nezměkčuj.

PŘÍKLADY ŠPATNĚ → SPRÁVNĚ:
✗ „Ta książka to nie tylko poradnik — to podróż w głąb siebie."
✓ „Przeczytałam ją w trzy dni. I coś się we mnie ruszyło."
✗ „Dieses Buch unterstreicht, wie wichtig es ist, loszulassen."
✓ „Ich habe auf dem Strandtuch geheult. Nicht vor Trauer. Vor Erleichterung."
✗ „Odkryj spokój — bez stresu, bez presji, bez wyrzutów sumienia."
✓ „Głosy w głowie nie zniknęły. Ale są cichsze. Mniejsze."
✗ „En dat veranderde alles. Niets was meer hetzelfde."
✓ „Mijn man vroeg op dag 5: 'Wat is er met jou gebeurd?'"`

/**
 * Prompt for the second, automatic humanizer pass: audit the translated copy
 * for AI tells, then rewrite. Returns strict JSON so the pipeline can store
 * both the findings and the polished texts.
 */
export function buildHumanizerPrompt(
  langName: string, primaries: string[], headlines: string[],
  opts?: { headlineRules?: string; extraNote?: string }
) {
  return `Jsi přísný editor, který v textu odhaluje stopy AI generování a překladatelštiny. Níže je přeložená facebooková reklama v jazyce: ${langName}.

KROK 1: Najdi konkrétní místa, která působí AI-generovaně nebo jako doslovný překlad — podle těchto pravidel:

${HUMANIZER_RULES}
${opts?.headlineRules ? `\n${opts.headlineRules}\n` : ""}${opts?.extraNote ? `\n${opts.extraNote}\n` : ""}
KROK 2: Přepiš texty tak, aby všechna nalezená místa zmizela. Zachovej: jazyk, strukturu odstavců, délku, fakta, čísla, emoji, odkazy a rod vypravěče. Neměň, co je v pořádku.

TEXTY KE KONTROLE:
${primaries.map((p, i) => `PRIMARY_${i + 1}: ${p}`).join("\n")}
${headlines.map((h, i) => `HEADLINE_${i + 1}: ${h}`).join("\n")}

Odpověz POUZE validním JSON (tells česky, stručně; texty v jazyce ${langName}):
{"tells": ["nalezený problém 1", "..."], "primaries": ["..."], "headlines": ["..."]}
Pokud je text čistý, vrať "tells": [] a texty beze změny.
POZOR: uvnitř JSON stringů nikdy nepoužívej neescapované dvojité uvozovky — když v tells cituješ text, cituj «takto» nebo ‚takto'.`
}
