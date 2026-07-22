// @ts-nocheck
/**
 * Seed the Comgate gateway for zivot-zaslugy (nejdriv-ja.cz).
 *
 * Mirrors the odpust-knizka setup (gateway 01KXDW22WJBG617KRFTB5DVWAZ): the same
 * 11 CZ bank buttons plus the embedded card form, so both CZ checkouts offer an
 * identical payment strip.
 *
 * Credentials come from the Comgate portal → Integrace → Propojení obchodu:
 *   COMGATE_MID    — "Identifikátor propojení obchodu" (516080 for nejdriv-ja.cz)
 *   COMGATE_SECRET — the "Heslo" field of the connection
 *
 * Run:
 *   COMGATE_MID=516080 COMGATE_SECRET=yyyy npx medusa exec ./src/scripts/seed-comgate-zivot-zaslugy.ts
 *
 * Idempotent: re-running updates the existing gateway instead of adding a second one.
 */

const PROJECT_SLUG = "zivot-zaslugy"
const DISPLAY_NAME = "Comgate - Život, jaký si zasloužíš"

// Same order as odpust-knizka so the checkout renders the buttons identically.
const METHODS = [
  { code: "bank_cz_cs", display_name: "Česká spořitelna", icon: "bank_cz_cs" },
  { code: "bank_cz_rb", display_name: "Raiffeisenbank", icon: "bank_cz_rb" },
  { code: "bank_cz_kb", display_name: "Komerční banka", icon: "bank_cz_kb" },
  { code: "bank_cz_fb", display_name: "Fio banka", icon: "bank_cz_fb" },
  { code: "bank_cz_pb", display_name: "Partners Banka", icon: "bank_cz_pb" },
  { code: "bank_cz_mb", display_name: "mBank", icon: "bank_cz_mb" },
  { code: "bank_cz_ab", display_name: "Air Bank", icon: "bank_cz_ab" },
  { code: "bank_cz_mo", display_name: "Moneta Money Bank", icon: "bank_cz_mo" },
  { code: "bank_cz_csob", display_name: "ČSOB", icon: "bank_cz_csob" },
  { code: "bank_cz_uc", display_name: "UniCredit Bank", icon: "bank_cz_uc" },
  // Cvak (BANK_CZ_AB_CVAK) — Air Bank A2A payment confirmed in the My Air app.
  { code: "bank_cz_cvak", display_name: "Cvak — Air Bank", icon: "bank_cz_cvak" },
  { code: "bank_cz_other", display_name: "Jiná banka (převod)", icon: "bank_transfer" },
  { code: "creditcard", display_name: "Credit/Debit Card", icon: "card", config: { type: "embedded" }, anyCurrency: true },
]

export default async function seedComgateZivotZaslugy() {
  const mid = String(process.env.COMGATE_MID || "").trim()
  const secret = String(process.env.COMGATE_SECRET || "").trim()
  if (!mid || !secret) {
    throw new Error("COMGATE_MID and COMGATE_SECRET env vars are required")
  }
  if (!/^\d{5,8}$/.test(mid)) {
    throw new Error(`COMGATE_MID "${mid}" does not look like a Comgate merchant id (5-8 digits)`)
  }

  const { Pool } = require("pg")
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 })
  const ulid = () => require("ulid").ulid()

  try {
    const { rows: existing } = await pool.query(
      `SELECT id FROM gateway_config
        WHERE provider = 'comgate' AND deleted_at IS NULL
          AND project_slugs @> $1::jsonb`,
      [JSON.stringify([PROJECT_SLUG])]
    )

    let gatewayId: string
    if (existing[0]) {
      gatewayId = existing[0].id
      await pool.query(
        `UPDATE gateway_config
            SET live_keys = $1::jsonb, mode = 'live', is_active = true,
                display_name = $2, supported_currencies = '["CZK"]'::jsonb,
                updated_at = NOW()
          WHERE id = $3`,
        [JSON.stringify({ api_key: mid, secret_key: secret, webhook_secret: "" }), DISPLAY_NAME, gatewayId]
      )
      console.log(`[Comgate Seed] updated existing gateway ${gatewayId}`)
    } else {
      gatewayId = ulid()
      await pool.query(
        `INSERT INTO gateway_config
           (id, provider, display_name, mode, live_keys, test_keys, supported_currencies,
            priority, is_active, project_slugs, created_at, updated_at)
         VALUES ($1, 'comgate', $2, 'live', $3::jsonb, '{}'::jsonb, '["CZK"]'::jsonb,
                 1, true, $4::jsonb, NOW(), NOW())`,
        [
          gatewayId,
          DISPLAY_NAME,
          JSON.stringify({ api_key: mid, secret_key: secret, webhook_secret: "" }),
          JSON.stringify([PROJECT_SLUG]),
        ]
      )
      console.log(`[Comgate Seed] created gateway ${gatewayId}`)
    }

    let created = 0
    let updated = 0
    for (let i = 0; i < METHODS.length; i++) {
      const m = METHODS[i]
      const currencies = m.anyCurrency ? [] : ["CZK"]
      const countries = m.anyCurrency ? [] : ["cz"]
      const { rows: have } = await pool.query(
        `SELECT id FROM payment_method_config
          WHERE gateway_id = $1 AND code = $2 AND deleted_at IS NULL`,
        [gatewayId, m.code]
      )
      if (have[0]) {
        await pool.query(
          `UPDATE payment_method_config
              SET display_name = $1, icon = $2, sort_order = $3, is_active = true,
                  supported_currencies = $4::jsonb, available_countries = $5::jsonb,
                  config = $6::jsonb, updated_at = NOW()
            WHERE id = $7`,
          [m.display_name, m.icon, i, JSON.stringify(currencies), JSON.stringify(countries),
           m.config ? JSON.stringify(m.config) : null, have[0].id]
        )
        updated++
      } else {
        await pool.query(
          `INSERT INTO payment_method_config
             (id, gateway_id, code, display_name, icon, sort_order, is_active,
              supported_currencies, available_countries, config, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, true, $7::jsonb, $8::jsonb, $9::jsonb, NOW(), NOW())`,
          [ulid(), gatewayId, m.code, m.display_name, m.icon, i,
           JSON.stringify(currencies), JSON.stringify(countries),
           m.config ? JSON.stringify(m.config) : null]
        )
        created++
      }
    }

    console.log(`[Comgate Seed] methods: ${created} created, ${updated} updated (${METHODS.length} total)`)
    console.log(`[Comgate Seed] done — gateway ${gatewayId} for ${PROJECT_SLUG} (MID ${mid})`)
  } finally {
    await pool.end().catch(() => {})
  }
}
