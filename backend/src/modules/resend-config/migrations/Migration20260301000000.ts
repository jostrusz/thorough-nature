import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260301000000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "resend_config" ("id" text not null, "project_id" text not null, "label" text not null, "api_key" text not null, "from_email" text not null, "from_name" text null, "reply_to" text null, "use_for" jsonb null default '["all"]', "enabled" boolean not null default true, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "resend_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_resend_config_deleted_at" ON "resend_config" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "resend_config" cascade;`);
  }

}
