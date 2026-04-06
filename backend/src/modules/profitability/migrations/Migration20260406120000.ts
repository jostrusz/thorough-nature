import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260406120000 extends Migration {

  override async up(): Promise<void> {
    // Add currency_code column with default EUR
    this.addSql(`ALTER TABLE "project_config" ADD COLUMN IF NOT EXISTS "currency_code" TEXT NOT NULL DEFAULT 'EUR';`)

    // Set currency codes for existing projects
    this.addSql(`UPDATE "project_config" SET "currency_code" = 'SEK' WHERE "project_slug" = 'slapp-taget';`)
    this.addSql(`UPDATE "project_config" SET "currency_code" = 'CZK' WHERE "project_slug" = 'psi-superzivot';`)
    this.addSql(`UPDATE "project_config" SET "currency_code" = 'PLN' WHERE "project_slug" = 'odpusc-ksiazka';`)
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "project_config" DROP COLUMN IF EXISTS "currency_code";`)
  }

}
