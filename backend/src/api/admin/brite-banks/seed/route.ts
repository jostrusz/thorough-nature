// @ts-nocheck
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Pool } from "pg"
import { BRITE_BANK_SEED } from "../../../../modules/brite-bank-logos/seed-data"

/**
 * POST /admin/brite-banks/seed
 *
 * Idempotently loads the Brite bank_id seed (sandbox + production sets) into
 * brite_bank_logo. Safe to re-run — replaces all seeded rows. Logos are left
 * empty (filled later by the bank.list cron). Each row carries its `mode`
 * (test|live) so /store/banks can return the set matching the active gateway.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 })
  try {
    // Ensure the mode column exists (defensive — migration also adds it)
    await pool.query(`ALTER TABLE "brite_bank_logo" ADD COLUMN IF NOT EXISTS "mode" text NOT NULL DEFAULT 'test'`)

    let inserted = 0
    for (const mode of ["test", "live"] as const) {
      const banks = BRITE_BANK_SEED[mode] || []
      // Replace this mode's rows
      await pool.query(`DELETE FROM brite_bank_logo WHERE mode = $1`, [mode])
      let sortByCountry: Record<string, number> = {}
      for (const b of banks) {
        const country = b.country.toUpperCase()
        const sort = (sortByCountry[country] = (sortByCountry[country] ?? -1) + 1)
        const id = `bbl_${mode}_${country}_${b.bank_id}`
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "_")
          .slice(0, 150)
        await pool.query(
          `INSERT INTO brite_bank_logo
             (id, country, locale, bank_id, name, logo_url, sort_order, is_active, mode, metadata, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8,$9::jsonb,now(),now())
           ON CONFLICT (id) DO UPDATE SET
             name = EXCLUDED.name, bank_id = EXCLUDED.bank_id,
             sort_order = EXCLUDED.sort_order, mode = EXCLUDED.mode,
             updated_at = now(), deleted_at = null`,
          [id, country, country.toLowerCase(), b.bank_id, b.name, "", sort, mode, JSON.stringify({ source: "seed-csv" })]
        )
        inserted++
      }
    }

    const { rows } = await pool.query(
      `SELECT mode, country, count(*)::int AS n FROM brite_bank_logo WHERE deleted_at IS NULL GROUP BY mode, country ORDER BY mode, country`
    )
    res.json({ success: true, inserted, breakdown: rows })
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message })
  } finally {
    await pool.end().catch(() => {})
  }
}
