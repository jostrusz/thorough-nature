import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260225114609 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "meta_pixel_config" ("id" text not null, "project_id" text not null, "pixel_id" text not null, "access_token" text not null, "test_event_code" text null, "enabled" boolean not null default true, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "meta_pixel_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_meta_pixel_config_deleted_at" ON "meta_pixel_config" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "meta_pixel_config" cascade;`);
  }

}
