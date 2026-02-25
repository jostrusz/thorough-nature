import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260225130821 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "quickbooks_config" ("id" text not null, "project_id" text not null, "client_id" text not null, "client_secret" text not null, "environment" text not null default 'sandbox', "access_token" text null, "refresh_token" text null, "access_token_expires_at" text null, "refresh_token_expires_at" text null, "realm_id" text null, "default_item_id" text null, "redirect_uri" text null, "is_connected" boolean not null default false, "enabled" boolean not null default true, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "quickbooks_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_quickbooks_config_deleted_at" ON "quickbooks_config" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "quickbooks_config" cascade;`);
  }

}
