// @ts-nocheck
/**
 * Country / project order-defaults matrix — the single source of truth for the
 * manual "Create Order" feature (admin AI order creator).
 *
 * WHY THIS EXISTS
 * ----------------
 * Manual orders were created with market-agnostic, over-broad options (all 11
 * payment methods, a flat global shipping-option list, currency defaulting to
 * "eur"). That produced wrong-currency orders for SE/PL/NO and let an admin pick
 * a shipping option that has no Dextrum delivery mapping → the order sticks in
 * the warehouse (cf. PL2026-15268 / PL2026-329 — a Paczkomat option chosen for a
 * home-delivery order with no pickupPlaceCode).
 *
 * This matrix is derived from the REAL distribution of production orders
 * (last 120 days) and from the verified shipping-option / sales-channel /
 * region IDs. All IDs below were confirmed against the production DB.
 *
 * HARD RULE: the *default* shipping option for every market is the HOME-delivery
 * option — it always has a clean Dextrum mapping and needs no pickup-point code.
 * Pickup (Paczkomat / výdejní místo) is opt-in and REQUIRES a pickup code, so the
 * UI must block submit when a pickup option is chosen and no code is entered.
 *
 * Pure data + helpers — no server-only imports — so it is safe to import from
 * both backend API routes and the admin dashboard bundle.
 */

// ── Region IDs (verified) — one per currency zone ──
export const REGION_IDS = {
  eur: "reg_01KJ9JF3JRFG9KS4ZMTZ9KRTKV", // Europe: at, be, de, lu, nl
  pln: "reg_01KK8N9GTWQK7A55SXAH07KNK1", // Poland (Odpusc Ksiazka)
  sek: "reg_01KK3DB2STB0WNFZKRPDHZWPTN", // Sweden
  nok: "reg_01KRD3ABWEDY16N07ST8PNJ9XZ", // Norway
  czk: "reg_01KKB4EZN0CHFYDG64K4VP0J2A", // Czech Republic (Psi Superzivot)
  huf: "reg_01KWG6W2W6Z2YR8GVBRM3CEVHX", // Hungary (Engedd El)
  eur_sk: "reg_01KWVAZVNATPX01HH77MYWKG3M", // Slovakia (Pusti To SK) — own EUR region
  eur_fr: "reg_01KX052MRE4BSM059VN4SH2AY0", // France (Lache Livre) — own EUR region
} as const

// ── Shipping option IDs (verified) ──
const SO = {
  GLS_NL: "so_01KJ9JF3P8JV32D6P93KWQS19C",        // GLS — Gratis verzending (NL/BE home)
  KOSTENLOS_DE: "so_01KKAY49P9TFH0DXZRQPJKK33C",  // Kostenloser Versand (DE/AT/LU home)
  INPOST_HOME_PL: "so_01KKGAKSYWYQE1FMKEQ047AYFE",// inPost - Dostawa do domu (PL home)
  INPOST_PICKUP_PL: "so_01KK8NA0GHF7AC3DCTSDB2FBSC", // inPost Paczkomaty (PL pickup, needs code)
  POSTNORD_SE: "so_01KK204GTRJF5JWDKE3BE95NHM",   // Fri frakt (PostNord) (SE home)
  GLS_NO: "so_01KRDNORWAY000000SHIPOPT01",        // Gratis frakt (GLS) (NO home)
  ZAS_HOME_CZ: "so_01KNF1RPN6Q82NVBGF0QBBH20Z",   // Zásilkovna - Na adresu (CZ Psi home)
  ZAS_PICKUP_CZ: "so_01KNF1QYEZC1Y1Y1A0FX35X3YT", // Zásilkovna - Na výdejní místo (CZ Psi pickup)
  ZAS_HOME_KOCICI: "so_01KPFQ9PQGXCMG4M5ZQBD7DYZP",   // Zásilkovna - Na adresu (Kocici Bible home)
  ZAS_PICKUP_KOCICI: "so_01KPFQ9PQF5S7RRKVZ6RDB5ZZE", // Zásilkovna - Na výdejní místo (Kocici pickup)
  ZAS_HOME_ODPUST: "so_01KTTR2B5J2XPRAHNQHHDQ0XVN",   // Zásilkovna - Na adresu (Odpust Knizka home)
  ZAS_PICKUP_ODPUST: "so_01KTTR2B5JRA8H022ERJSR3ANJ", // Zásilkovna - Na výdejní místo (Odpust pickup)
  ZAS_HOME_ENGEDD: "so_01KWG6WEBKTHWESMJAJHB0ZZ54",   // Packeta - Házhozszállítás (Engedd El home)
  ZAS_PICKUP_ENGEDD: "so_01KWG6WEBJTVGR0M8NHPRSRQBS", // Packeta - Csomagpont (Engedd El pickup)
  ZAS_HOME_PUSTI_SK: "so_01KWVB06DRRS7ZP2E5AY6N3VR3",   // Packeta - Na adresu (Pusti To SK home)
  ZAS_PICKUP_PUSTI_SK: "so_01KWVB06DRK51CQTSYYSA99TRP", // Packeta - Na odberné miesto (Pusti To SK pickup)
  ZAS_HOME_ZIVOT: "so_01KX5YH9DXCFCNYAZQZ5KQ8E9G",    // Zásilkovna - Na adresu (Zivot Zaslugy home)
  ZAS_PICKUP_ZIVOT: "so_01KX5YH9DWAP797Y0QC5J6FKJ9",  // Zásilkovna - Na výdejní místo (Zivot Zaslugy pickup)
  ZAS_HOME_LACHE: "so_01KX053135P5BJNDHR1DV25WFF",      // Packeta - À domicile (Lache Livre FR home)
  ZAS_PICKUP_LACHE: "so_01KX053135Q3B19W0ZTC7WA6QH",    // Packeta - Point relais (Lache Livre FR pickup)
} as const

/**
 * Per-project config. The sales_channel_id drives the Dextrum delivery mapping
 * and the project_id metadata downstream code depends on. Shipping options are
 * project-scoped because the Dextrum mapping key is (sales_channel, shipping_option).
 */
export const PROJECT_CONFIG = {
  loslatenboek: {
    name: "Loslatenboek",
    sales_channel_id: "sc_01KJ9JF3G5WQJNN0XN0WA7D7SS",
    homeShippingOptionId: SO.GLS_NL,
    homeShippingOptionName: "GLS — Gratis verzending",
    pickupShippingOptionId: null,
    pickupShippingOptionName: null,
  },
  "het-leven": {
    name: "Het Leven",
    sales_channel_id: "sc_01KP3WW1CYJC35W7VMTWXE32JQ",
    homeShippingOptionId: SO.GLS_NL,
    homeShippingOptionName: "GLS — Gratis verzending",
    pickupShippingOptionId: null,
    pickupShippingOptionName: null,
  },
  dehondenbijbel: {
    name: "Dehondenbijbel",
    sales_channel_id: "sc_01KJYJNCCA3VPZE8Y5FGHXTTZX",
    homeShippingOptionId: SO.GLS_NL,
    homeShippingOptionName: "GLS — Gratis verzending",
    pickupShippingOptionId: null,
    pickupShippingOptionName: null,
  },
  "lass-los": {
    name: "Lass Los",
    sales_channel_id: "sc_01KKAY49EQ3P0CSDDWEN7E5S2D",
    homeShippingOptionId: SO.KOSTENLOS_DE,
    homeShippingOptionName: "Kostenloser Versand",
    pickupShippingOptionId: null,
    pickupShippingOptionName: null,
  },
  "odpusc-ksiazka": {
    name: "Odpusc Ksiazka",
    sales_channel_id: "sc_01KK8N9CVFMNNRW0QH3TEWT070",
    homeShippingOptionId: SO.INPOST_HOME_PL,
    homeShippingOptionName: "inPost - Dostawa do domu",
    pickupShippingOptionId: SO.INPOST_PICKUP_PL,
    pickupShippingOptionName: "inPost Paczkomaty",
  },
  "zycie-zaslugy": {
    name: "Zycie Zaslugy",
    sales_channel_id: "sc_01KQV21PJDHW3GNMKDE4GP9F5X",
    homeShippingOptionId: SO.INPOST_HOME_PL,
    homeShippingOptionName: "inPost - Dostawa do domu",
    pickupShippingOptionId: SO.INPOST_PICKUP_PL,
    pickupShippingOptionName: "inPost Paczkomaty",
  },
  "slapp-taget": {
    name: "Slapp Taget",
    sales_channel_id: "sc_01KK20402EMMDH9BPEQWWH0P1R",
    homeShippingOptionId: SO.POSTNORD_SE,
    homeShippingOptionName: "Fri frakt (PostNord)",
    pickupShippingOptionId: null,
    pickupShippingOptionName: null,
  },
  "slipp-taket": {
    name: "Slipp Taket",
    sales_channel_id: "sc_01KRD3ABWE1R1X7ZKJMMYZ1WHS",
    homeShippingOptionId: SO.GLS_NO,
    homeShippingOptionName: "Gratis frakt (GLS)",
    pickupShippingOptionId: null,
    pickupShippingOptionName: null,
  },
  "psi-superzivot": {
    name: "Psi Superzivot",
    sales_channel_id: "sc_01KKB4EZK07PBYA4GY0RMGG98S",
    homeShippingOptionId: SO.ZAS_HOME_CZ,
    homeShippingOptionName: "Zásilkovna - Na adresu",
    pickupShippingOptionId: SO.ZAS_PICKUP_CZ,
    pickupShippingOptionName: "Zásilkovna - Na výdejní místo",
  },
  "kocici-bible": {
    name: "Kocici Bible",
    sales_channel_id: "sc_01KPFP9KE8H15EACNETY5ZNCJP",
    homeShippingOptionId: SO.ZAS_HOME_KOCICI,
    homeShippingOptionName: "Zásilkovna - Na adresu",
    pickupShippingOptionId: SO.ZAS_PICKUP_KOCICI,
    pickupShippingOptionName: "Zásilkovna - Na výdejní místo",
  },
  "odpust-knizka": {
    name: "Odpust Knizka",
    sales_channel_id: "sc_01KTTR1W2GDWQC8R6NE12V7MWT",
    homeShippingOptionId: SO.ZAS_HOME_ODPUST,
    homeShippingOptionName: "Zásilkovna - Na adresu",
    pickupShippingOptionId: SO.ZAS_PICKUP_ODPUST,
    pickupShippingOptionName: "Zásilkovna - Na výdejní místo",
  },
  "zivot-zaslugy": {
    name: "Zivot Zaslugy",
    sales_channel_id: "sc_01KX5YGZJ8631J42PQAJ4CWVPT",
    homeShippingOptionId: SO.ZAS_HOME_ZIVOT,
    homeShippingOptionName: "Zásilkovna - Na adresu",
    pickupShippingOptionId: SO.ZAS_PICKUP_ZIVOT,
    pickupShippingOptionName: "Zásilkovna - Na výdejní místo",
  },
  "engedd-el": {
    name: "Engedd El",
    sales_channel_id: "sc_01KWG6W0N5K3E9AVYAKY38EQ8D",
    homeShippingOptionId: SO.ZAS_HOME_ENGEDD,
    homeShippingOptionName: "Packeta - Házhozszállítás",
    pickupShippingOptionId: SO.ZAS_PICKUP_ENGEDD,
    pickupShippingOptionName: "Packeta - Csomagpont",
  },
  "pusti-to-sk": {
    name: "pusti-to-sk",
    sales_channel_id: "sc_01KWVAX8XTNTXHF9ZWH211Y6CF",
    homeShippingOptionId: SO.ZAS_HOME_PUSTI_SK,
    homeShippingOptionName: "Packeta - Na adresu",
    pickupShippingOptionId: SO.ZAS_PICKUP_PUSTI_SK,
    pickupShippingOptionName: "Packeta - Na odberné miesto",
  },
  "lache-livre": {
    name: "lache-livre",
    sales_channel_id: "sc_01KX052J6D5FB9QAKGZEVG37DT",
    homeShippingOptionId: SO.ZAS_HOME_LACHE,
    homeShippingOptionName: "Packeta - À domicile",
    pickupShippingOptionId: SO.ZAS_PICKUP_LACHE,
    pickupShippingOptionName: "Packeta - Point relais",
  },
} as const

/**
 * Per-country config. Currency/region are 100% deterministic per country.
 * Allowed payment methods + the dominant default are derived from real order
 * data. COD is only offered where it has a Dextrum mapping (CZ / Psi Superzivot).
 * projectSlugs lists which projects ship to that market (first = default).
 */
export const COUNTRY_CONFIG = {
  nl: {
    label: "🇳🇱 Netherlands",
    currency: "eur",
    region_id: REGION_IDS.eur,
    allowedPaymentMethods: ["ideal", "creditcard"],
    defaultPaymentMethod: "ideal",
    codAllowed: false,
    projectSlugs: ["loslatenboek", "het-leven", "dehondenbijbel"],
    bookVatRate: 9,
  },
  be: {
    label: "🇧🇪 Belgium",
    currency: "eur",
    region_id: REGION_IDS.eur,
    allowedPaymentMethods: ["bancontact", "creditcard"],
    defaultPaymentMethod: "bancontact",
    codAllowed: false,
    projectSlugs: ["loslatenboek", "het-leven", "dehondenbijbel"],
    bookVatRate: 6,
  },
  de: {
    label: "🇩🇪 Germany",
    currency: "eur",
    region_id: REGION_IDS.eur,
    allowedPaymentMethods: ["creditcard", "paypal"],
    defaultPaymentMethod: "creditcard",
    codAllowed: false,
    projectSlugs: ["lass-los"],
    bookVatRate: 7,
  },
  at: {
    label: "🇦🇹 Austria",
    currency: "eur",
    region_id: REGION_IDS.eur,
    allowedPaymentMethods: ["creditcard", "paypal"],
    defaultPaymentMethod: "creditcard",
    codAllowed: false,
    projectSlugs: ["lass-los"],
    bookVatRate: 10,
  },
  lu: {
    label: "🇱🇺 Luxembourg",
    currency: "eur",
    region_id: REGION_IDS.eur,
    allowedPaymentMethods: ["creditcard", "paypal"],
    defaultPaymentMethod: "creditcard",
    codAllowed: false,
    projectSlugs: ["lass-los"],
    bookVatRate: 3,
  },
  pl: {
    label: "🇵🇱 Poland",
    currency: "pln",
    region_id: REGION_IDS.pln,
    allowedPaymentMethods: ["blik", "przelewy24", "creditcard"],
    defaultPaymentMethod: "blik",
    codAllowed: false,
    projectSlugs: ["odpusc-ksiazka", "zycie-zaslugy"],
    bookVatRate: 5,
  },
  se: {
    label: "🇸🇪 Sweden",
    currency: "sek",
    region_id: REGION_IDS.sek,
    allowedPaymentMethods: ["creditcard"],
    defaultPaymentMethod: "creditcard",
    codAllowed: false,
    projectSlugs: ["slapp-taget"],
    bookVatRate: 6,
  },
  no: {
    label: "🇳🇴 Norway",
    currency: "nok",
    region_id: REGION_IDS.nok,
    allowedPaymentMethods: ["creditcard"],
    defaultPaymentMethod: "creditcard",
    codAllowed: false,
    projectSlugs: ["slipp-taket"],
    bookVatRate: 0,
  },
  cz: {
    label: "🇨🇿 Czech Republic",
    currency: "czk",
    region_id: REGION_IDS.czk,
    allowedPaymentMethods: ["creditcard", "cod"],
    defaultPaymentMethod: "creditcard",
    codAllowed: true,
    projectSlugs: ["psi-superzivot", "kocici-bible", "odpust-knizka", "zivot-zaslugy"],
    bookVatRate: 0,
  },
  sk: {
    label: "🇸🇰 Slovakia",
    currency: "eur",
    region_id: REGION_IDS.eur_sk,
    allowedPaymentMethods: ["creditcard", "paypal"],
    defaultPaymentMethod: "creditcard",
    codAllowed: false,
    projectSlugs: ["pusti-to-sk"],
    bookVatRate: 5,
  },
  fr: {
    label: "🇫🇷 France",
    currency: "eur",
    region_id: REGION_IDS.eur_fr,
    allowedPaymentMethods: ["creditcard", "paypal"],
    defaultPaymentMethod: "creditcard",
    codAllowed: false,
    projectSlugs: ["lache-livre"],
    bookVatRate: 5.5,
  },
  hu: {
    label: "🇭🇺 Hungary",
    currency: "huf",
    region_id: REGION_IDS.huf,
    // No gateway chosen yet (payment provider TBD) — manual order creator
    // will show no payment options for HU until gateway_config is set.
    allowedPaymentMethods: [],
    defaultPaymentMethod: null,
    codAllowed: false,
    projectSlugs: ["engedd-el"],
    bookVatRate: 5,
  },
} as const

export const SUPPORTED_COUNTRIES = Object.keys(COUNTRY_CONFIG)

/**
 * Resolve the deterministic order defaults for a given country (+ optional
 * project). Returns everything the create route / modal needs to pre-fill a
 * draft that flows cleanly through checkout automation.
 *
 * @param countryCode ISO 2-letter (case-insensitive)
 * @param projectSlug optional; falls back to the country's default project
 * @param usesPickup  if true, returns the pickup shipping option (requires code)
 */
export function resolveOrderDefaults(countryCode, projectSlug, usesPickup = false) {
  const cc = String(countryCode || "").toLowerCase()
  const country = COUNTRY_CONFIG[cc]
  if (!country) return null

  const slug =
    projectSlug && country.projectSlugs.includes(projectSlug)
      ? projectSlug
      : country.projectSlugs[0]
  const project = PROJECT_CONFIG[slug]
  if (!project) return null

  const wantsPickup = usesPickup && !!project.pickupShippingOptionId
  const shippingOptionId = wantsPickup
    ? project.pickupShippingOptionId
    : project.homeShippingOptionId
  const shippingOptionName = wantsPickup
    ? project.pickupShippingOptionName
    : project.homeShippingOptionName

  return {
    country_code: cc,
    currency_code: country.currency,
    region_id: country.region_id,
    project_slug: slug,
    project_name: project.name,
    sales_channel_id: project.sales_channel_id,
    shipping_option_id: shippingOptionId,
    shipping_option_name: shippingOptionName,
    shipping_method_type: wantsPickup ? "zasilkovna_pickup" : "home_delivery",
    requires_pickup_code: wantsPickup,
    has_pickup_option: !!project.pickupShippingOptionId,
    allowed_payment_methods: country.allowedPaymentMethods,
    default_payment_method: country.defaultPaymentMethod,
    cod_allowed: country.codAllowed,
    book_vat_rate: country.bookVatRate,
  }
}

/** Compact matrix for injecting into the AI extraction prompt. */
export function buildAiCountryMatrix() {
  return SUPPORTED_COUNTRIES.map((cc) => {
    const c = COUNTRY_CONFIG[cc]
    const projects = c.projectSlugs
      .map((s) => `${s} (${PROJECT_CONFIG[s].name})`)
      .join(" | ")
    return `- ${cc} ${c.label}: currency=${c.currency}, payment=[${c.allowedPaymentMethods.join(
      ", "
    )}] default ${c.defaultPaymentMethod}, projects=[${projects}]`
  }).join("\n")
}
