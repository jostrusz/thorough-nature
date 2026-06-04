// @ts-nocheck
/**
 * Brite bank_id seed data — provided by Brite for the merchant's markets.
 *
 * IMPORTANT: bank_id values are ENVIRONMENT-SPECIFIC.
 *   - `test` set  → sandbox.britepaymentgroup.com (includes Brite "Test Bank")
 *   - `live` set  → production
 * /store/banks returns the set matching the active gateway's mode.
 *
 * Order within each market is preserved from Brite's CSV (≈ market-share order)
 * and used as sort_order. Logos are intentionally empty here — they get filled
 * by the daily bank.list cron (base64) once credentials are active; until then
 * the storefront picker renders a styled name fallback.
 *
 * Markets supplied: BE, DE, NL, SE. (AT, LU, NO not in Brite's list yet — those
 * get populated by bank.list once live, or request from Brite.)
 */
export type BriteSeedBank = { country: string; name: string; bank_id: string }

export const BRITE_BANK_SEED: { test: BriteSeedBank[]; live: BriteSeedBank[] } = {
  test: [
    // ── BE (sandbox) ──
    { country: "BE", name: "Test Bank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA5peOkgkM" },
    { country: "BE", name: "ING", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAlqWSwAgM" },
    { country: "BE", name: "BNP Paribas Fortis", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAluuAuAgM" },
    { country: "BE", name: "Belfius", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA5t7vpQkM" },
    { country: "BE", name: "KBC", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA5uPMggkM" },
    { country: "BE", name: "CBC", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAtsTKlAsM" },
    { country: "BE", name: "Argenta", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAlqW9mQkM" },
    { country: "BE", name: "Hello Bank!", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA5teLiAsM" },
    { country: "BE", name: "Fintro", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA5tfBgAsM" },
    { country: "BE", name: "VDK", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA5t7vpQsM" },
    // ── DE (sandbox) ──
    { country: "DE", name: "Test Bank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAioebjQsM" },
    { country: "DE", name: "Sparkasse", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA-fao_QgM" },
    { country: "DE", name: "Volksbank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA0Yq_zAsM" },
    { country: "DE", name: "Postbank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAhbjLrAgM" },
    { country: "DE", name: "Commerzbank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAiduWzggM" },
    { country: "DE", name: "N26", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA-fOupAkM" },
    { country: "DE", name: "HypoVereinsbank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA28CxjQkM" },
    { country: "DE", name: "ING", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAuZ677AsM" },
    { country: "DE", name: "Revolut", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAq_uBiQkM" },
    { country: "DE", name: "Deutsche Bank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA-fPZ9QoM" },
    { country: "DE", name: "Norisbank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA2dGRowkM" },
    { country: "DE", name: "C24", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAh6b9lwkM" },
    { country: "DE", name: "Comdirect", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA-Y2vtQgM" },
    { country: "DE", name: "Targobank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA_ePf-gsM" },
    { country: "DE", name: "DKB", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAmbK85AgM" },
    // ── NL (sandbox) ──
    { country: "NL", name: "Test Bank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAiqG8iAsM" },
    { country: "NL", name: "ING", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA0uGjywoM" },
    { country: "NL", name: "Rabobank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAwqXPyAkM" },
    { country: "NL", name: "ABN AMRO", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA0vKmgAoM" },
    { country: "NL", name: "ASN Bank voorheen SNS", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA4sCV2ggM" },
    { country: "NL", name: "ASN Bank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA4tXHmQoM" },
    { country: "NL", name: "ASN Bank voorheen RegioBank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAgpyXkgsM" },
    // ── SE (sandbox) ──
    { country: "SE", name: "Test Bank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAsv_kjAkM" },
    { country: "SE", name: "Swedbank & Sparbankerna", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA_JzijgoM" },
    { country: "SE", name: "Nordea", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA_Jy2nwoM" },
    { country: "SE", name: "Handelsbanken", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA3PCPmgoM" },
    { country: "SE", name: "SEB", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAnNiJkgoM" },
    { country: "SE", name: "Länsförsäkringar", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAvJ_chwoM" },
    { country: "SE", name: "ICA Banken", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICAvPzDjwoM" },
    { country: "SE", name: "Skandiabanken", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA7KXBjQoM" },
    { country: "SE", name: "Danske Bank", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA0tXUlgsM" },
    { country: "SE", name: "Sparbanken Syd", bank_id: "ag9ofmFib25lYS0xNzYyMTNyEQsSBEJhbmsYgICA8oXe1ggM" },
  ],
  live: [
    // ── BE (production) ──
    { country: "BE", name: "ING", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA7IH2xQgM" },
    { country: "BE", name: "BNP Paribas Fortis", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICArNW48goM" },
    { country: "BE", name: "Belfius", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAnNvE-QkM" },
    { country: "BE", name: "KBC", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA7Iry0wkM" },
    { country: "BE", name: "CBC", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA7OOFqwgM" },
    { country: "BE", name: "Argenta", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA7K2f4AkM" },
    { country: "BE", name: "Hello Bank!", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA7O-9uQgM" },
    { country: "BE", name: "Fintro", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAtKuY7gkM" },
    { country: "BE", name: "Revolut", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAnJuBiwsM" },
    { country: "BE", name: "N26", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA56m6uQoM" },
    { country: "BE", name: "VDK", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAtMur9AsM" },
    // ── DE (production) ──
    { country: "DE", name: "Sparkasse", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAotLT_AoM" },
    { country: "DE", name: "Volksbank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA8oT80AsM" },
    { country: "DE", name: "Postbank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAksaT5AkM" },
    { country: "DE", name: "Commerzbank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAspXlgwsM" },
    { country: "DE", name: "N26", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA4rWP1QsM" },
    { country: "DE", name: "HypoVereinsbank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAs-_lrQkM" },
    { country: "DE", name: "ING", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA8oT8sAkM" },
    { country: "DE", name: "Revolut", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAofie8AoM" },
    { country: "DE", name: "Deutsche Bank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA0oGH1gkM" },
    { country: "DE", name: "Norisbank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAspWjrQsM" },
    { country: "DE", name: "C24", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAnYqCgQoM" },
    { country: "DE", name: "Comdirect", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAspfBuwkM" },
    { country: "DE", name: "Targobank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAjeOEsQkM" },
    { country: "DE", name: "DKB", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAhtetzwgM" },
    // ── NL (production) ──
    { country: "NL", name: "ING", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAkJOzjQkM" },
    { country: "NL", name: "Rabobank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA4MjrxAoM" },
    { country: "NL", name: "ABN AMRO", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA4MO21QkM" },
    { country: "NL", name: "ASN Bank voorheen SNS", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAwLnkowsM" },
    { country: "NL", name: "ASN Bank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAkJChqQoM" },
    { country: "NL", name: "ASN Bank voorheen RegioBank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAgNu45goM" },
    // ── SE (production) ──
    { country: "SE", name: "Swedbank & Sparbankerna", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAkLCzggkM" },
    { country: "SE", name: "Nordea", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAgN6MkAoM" },
    { country: "SE", name: "Handelsbanken", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAkNKKgQoM" },
    { country: "SE", name: "SEB", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAoLu6kQkM" },
    { country: "SE", name: "Länsförsäkringar", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAkOGrgwoM" },
    { country: "SE", name: "ICA Banken", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA4MnDgwkM" },
    { country: "SE", name: "Skandiabanken", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAoLvsgAkM" },
    { country: "SE", name: "Danske Bank", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICA4OX1kgsM" },
    { country: "SE", name: "Sparbanken Syd", bank_id: "ag9ofmFib25lYS0yNDkwMTRyEQsSBEJhbmsYgICAsLja-gsM" },
  ],
}
