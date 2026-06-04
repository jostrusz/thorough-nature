import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Add `mode` (test | live) to brite_bank_logo.
 *
 * Brite bank_id values are ENVIRONMENT-SPECIFIC — the sandbox id for "ING NL"
 * differs from the production id. We store both sets and let /store/banks return
 * the set matching the active gateway's mode.
 */
export class Migration20260604160000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "brite_bank_logo" ADD COLUMN IF NOT EXISTS "mode" text NOT NULL DEFAULT 'test';`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_brite_bank_logo_country_mode" ON "brite_bank_logo" ("country", "mode") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_brite_bank_logo_country_mode";`)
    this.addSql(`ALTER TABLE "brite_bank_logo" DROP COLUMN IF EXISTS "mode";`)
  }
}
