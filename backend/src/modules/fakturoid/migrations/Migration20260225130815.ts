import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260225130815 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "fakturoid_config" ("id" text not null, "project_id" text not null, "slug" text not null, "client_id" text not null, "client_secret" text not null, "user_agent_email" text not null, "access_token" text null, "token_expires_at" text null, "enabled" boolean not null default true, "default_language" text not null default 'en', "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "fakturoid_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_fakturoid_config_deleted_at" ON "fakturoid_config" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "fakturoid_config" cascade;`);
  }

}
