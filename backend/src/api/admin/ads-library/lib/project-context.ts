// @ts-nocheck
/**
 * Per-project context injected into the AI translation prompt so ads are
 * adapted natively (book facts, persona, form of address), not translated
 * word-for-word.
 */
export const PROJECT_CONTEXT: Record<string, {
  language: string; langName: string; book: string; author: string;
  address: string; domain: string; notes: string;
}> = {
  loslatenboek: {
    language: "NL", langName: "nizozemština", book: "Laat los wat je kapotmaakt",
    author: "Joris de Vries", address: "tykání (je/jij)", domain: "loslatenboek.nl",
    notes: "Self-help o pouštění minulosti: rozchody, vina, vztek. 290 stran + cvičení. Bonus 2 e-booky.",
  },
  "lass-los": {
    language: "DE", langName: "němčina", book: "Lass los, was dich kaputt macht",
    author: "Joris de Vries", address: "tykání (du)", domain: "jetztloslassen.de",
    notes: "Německý trh preferuje o něco věcnější tón než NL, ale du-forma zůstává.",
  },
  "odpusc-ksiazka": {
    language: "PL", langName: "polština", book: "Odpuść to, co cię niszczy",
    author: "Joris de Vries", address: "tykání (ty)", domain: "odpusc-ksiazka.pl",
    notes: "Emotivní, ženské publikum 35+. Bonus e-booky.",
  },
  "odpust-knizka": {
    language: "CZ", langName: "čeština", book: "Pusť to, co tě ničí",
    author: "Joris de Vries", address: "tykání", domain: "pusttocotenici.cz",
    notes: "Přirozená hovorová čeština, žádné kalky.",
  },
  "pusti-to-sk": {
    language: "SK", langName: "slovenština", book: "Pusti to, čo ťa ničí",
    author: "Joris de Vries", address: "tykání", domain: "pustitocotanici.sk",
    notes: "Slovenština, ne počeštěná.",
  },
  "slapp-taget": {
    language: "SE", langName: "švédština", book: "Släpp taget om det som förstör dig",
    author: "Joris de Vries", address: "tykání (du)", domain: "slapptagetboken.se",
    notes: "Civilní skandinávský tón, méně emotivních superlativů.",
  },
  "slipp-taket": {
    language: "NO", langName: "norština (bokmål)", book: "Slipp taket på det som ødelegger deg",
    author: "Joris de Vries", address: "tykání (du)", domain: "slipptaketboken.no",
    notes: "",
  },
  "engedd-el": {
    language: "HU", langName: "maďarština", book: "Engedd el, ami tönkretesz",
    author: "Joris de Vries", address: "tykání (tegezés)", domain: "engeddelkonyv.hu",
    notes: "336 stran, doručení na csomagpont. Přirozená maďarština, žádné anglicismy.",
  },
  "lache-livre": {
    language: "FR", langName: "francouzština", book: "Lâche prise sur ce qui te détruit",
    author: "Joris de Vries", address: "tykání (tutoiement)", domain: "lacheprise-livre.fr",
    notes: "36 €, 360 stran + cvičení, livraison offerte, 2 e-booky bonus (L'Antidote à l'overthinking, L'amour sans foutaises). Épicène — gender-neutrální formulace.",
  },
  "het-leven": {
    language: "NL", langName: "nizozemština", book: "Het leven dat je verdient",
    author: "Anna de Vries", address: "tykání (je/jij)", domain: "pakjeleventerug.nl",
    notes: "LIFE RESET kniha, ženské publikum, autorka Anna.",
  },
  "zivot-zaslugy": {
    language: "CZ", langName: "čeština", book: "Život, jaký si zasloužíš",
    author: "Anna de Vries", address: "tykání, ženský rod", domain: "nejdriv-ja.cz",
    notes: "Mluv k ženě (ženské tvary).",
  },
  "zycie-zaslugy": {
    language: "PL", langName: "polština", book: "Życie, jakiego nigdy sobie nie pozwoliłaś",
    author: "Anna de Vries", address: "tykání, ženský rod", domain: "najpierw-ja.pl",
    notes: "Gender-aware — žena k ženě.",
  },
  dehondenbijbel: {
    language: "NL", langName: "nizozemština", book: "De Hondenbijbel",
    author: "Lars Vermeulen", address: "vykání decentní (je ok)", domain: "dehondenbijbel.nl",
    notes: "Psí kniha — praktický, vřelý tón majitele psa.",
  },
  "psi-superzivot": {
    language: "CZ", langName: "čeština", book: "Psí superživot",
    author: "Lars Vermeulen", address: "tykání", domain: "psi-superzivot.cz",
    notes: "Psí kniha.",
  },
  "kocici-bible": {
    language: "CZ", langName: "čeština", book: "Kočičí bible",
    author: "Michal Peterka", address: "vykání", domain: "kocicibible.cz",
    notes: "Kočičí kniha, vykání (starší publikum).",
  },
  "biblia-kotow": {
    language: "PL", langName: "polština", book: "Biblia kotów",
    author: "Michal Peterka", address: "tykání", domain: "biblia-kotow.pl",
    notes: "Kočičí kniha.",
  },
}
