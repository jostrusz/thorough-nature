// Short, flag-prefixed project labels for the SupportBox admin — so same-book
// siblings (CZ "Pusť to" vs SK "Pusti to") are instantly distinguishable instead
// of showing a raw slug like "pusti-to-sk".
const PROJECT_LABELS: Record<string, string> = {
  loslatenboek: "🇳🇱 Laat los",
  "het-leven": "🇳🇱 Het Leven",
  dehondenbijbel: "🇳🇱 Hondenbijbel",
  "lass-los": "🇩🇪 Lass los",
  "odpusc-ksiazka": "🇵🇱 Odpuść",
  "zycie-zaslugy": "🇵🇱 Życie",
  "slapp-taget": "🇸🇪 Släpp taget",
  "slipp-taket": "🇳🇴 Slipp taket",
  "psi-superzivot": "🇨🇿 Psí superživot",
  "kocici-bible": "🇨🇿 Kočičí bible",
  "odpust-knizka": "🇨🇿 Pusť to (CZ)",
  "pusti-to-sk": "🇸🇰 Pusti to (SK)",
  "engedd-el": "🇭🇺 Engedd el",
}

export function projectLabel(slug?: string): string {
  if (!slug) return ""
  return PROJECT_LABELS[slug] || slug
}
