import { Migration } from "@medusajs/framework/mikro-orm/migrations"

export class Migration20260720190000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "ad_creative" add column if not exists "archived" boolean not null default false;`)
    this.addSql(`alter table "ad_creative" add column if not exists "archived_at" timestamptz null;`)
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_ad_creative_archived" ON "ad_creative" ("archived") WHERE deleted_at IS NULL;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "ad_creative" drop column if exists "archived";`)
    this.addSql(`alter table "ad_creative" drop column if exists "archived_at";`)
  }
}
