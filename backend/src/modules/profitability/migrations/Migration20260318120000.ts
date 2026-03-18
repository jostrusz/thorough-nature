import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260318120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "project_config" ADD COLUMN IF NOT EXISTS "domain" TEXT NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "project_config" DROP COLUMN IF EXISTS "domain";`)
  }

}
