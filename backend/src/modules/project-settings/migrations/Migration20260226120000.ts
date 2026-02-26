import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260226120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "project_settings" ("id" text not null, "project_id" text not null, "order_bump_enabled" boolean not null default true, "upsell_enabled" boolean not null default true, "foxentry_api_key" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "project_settings_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_project_settings_deleted_at" ON "project_settings" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "project_settings" cascade;`);
  }

}
