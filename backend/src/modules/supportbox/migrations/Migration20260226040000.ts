import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260226040000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "supportbox_config" ("id" text not null, "email_address" text not null, "display_name" text not null, "resend_api_key" text not null, "imap_host" text null, "imap_port" integer null, "imap_user" text null, "imap_password" text null, "imap_tls" boolean not null default true, "is_active" boolean not null default true, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supportbox_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_supportbox_config_deleted_at" ON "supportbox_config" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "supportbox_ticket" ("id" text not null, "config_id" text not null, "from_email" text not null, "from_name" text null, "subject" text not null, "status" text not null default 'new', "solved_at" text null, "order_id" text null, "customer_id" text null, "thread_key" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supportbox_ticket_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_supportbox_ticket_deleted_at" ON "supportbox_ticket" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "supportbox_message" ("id" text not null, "ticket_id" text not null, "direction" text not null, "from_email" text not null, "from_name" text null, "body_html" text not null, "body_text" text null, "resend_message_id" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "supportbox_message_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_supportbox_message_deleted_at" ON "supportbox_message" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "supportbox_message" cascade;`);

    this.addSql(`drop table if exists "supportbox_ticket" cascade;`);

    this.addSql(`drop table if exists "supportbox_config" cascade;`);
  }

}
