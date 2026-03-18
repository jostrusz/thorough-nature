import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260318130000 extends Migration {

  override async up(): Promise<void> {
    // Ensure column exists (idempotent)
    this.addSql(`ALTER TABLE "project_config" ADD COLUMN IF NOT EXISTS "domain" TEXT NULL;`)
    // Set default domains for existing projects
    this.addSql(`UPDATE "project_config" SET "domain" = 'slapptaget.se' WHERE "project_slug" = 'slapp-taget' AND ("domain" IS NULL OR "domain" = '');`)
    this.addSql(`UPDATE "project_config" SET "domain" = 'psisuperzivot.cz' WHERE "project_slug" = 'psi-superzivot' AND ("domain" IS NULL OR "domain" = '');`)
    this.addSql(`UPDATE "project_config" SET "domain" = 'dehondenbijbel.nl' WHERE "project_slug" = 'dehondenbijbel' AND ("domain" IS NULL OR "domain" = '');`)
    this.addSql(`UPDATE "project_config" SET "domain" = 'loslatenboek.nl' WHERE "project_slug" = 'laat-los' AND ("domain" IS NULL OR "domain" = '');`)
    this.addSql(`UPDATE "project_config" SET "domain" = 'lassloslive.de' WHERE "project_slug" = 'lass-los' AND ("domain" IS NULL OR "domain" = '');`)
  }

  override async down(): Promise<void> {
    this.addSql(`UPDATE "project_config" SET "domain" = NULL;`)
  }

}
