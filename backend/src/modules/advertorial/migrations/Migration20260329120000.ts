import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260329120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`
      ALTER TABLE "advertorial_page"
      ADD COLUMN IF NOT EXISTS "url_prefix" TEXT NULL;
    `)
  }

  override async down(): Promise<void> {
    this.addSql(`
      ALTER TABLE "advertorial_page"
      DROP COLUMN IF EXISTS "url_prefix";
    `)
  }
}
