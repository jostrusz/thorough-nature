import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260808120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "agent_conversation" ("id" text not null, "kind" text not null default 'ticket', "ticket_id" text null, "title" text null, "project" text null, "status" text not null default 'idle', "session_id" text null, "last_owner_read_at" text null, "last_activity_at" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_conversation_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_conversation_deleted_at" ON "agent_conversation" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_conversation_ticket" ON "agent_conversation" ("ticket_id") WHERE deleted_at IS NULL AND ticket_id IS NOT NULL;`);

    this.addSql(`create table if not exists "agent_message" ("id" text not null, "conversation_id" text not null, "role" text not null, "kind" text not null default 'chat', "body" text not null, "consumed_at" text null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_message_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_message_deleted_at" ON "agent_message" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_message_conversation" ON "agent_message" ("conversation_id");`);

    this.addSql(`create table if not exists "agent_task" ("id" text not null, "conversation_id" text null, "ticket_id" text null, "title" text not null, "description" text null, "action_type" text not null, "payload" jsonb null, "draft_reply" text null, "confidence" integer null, "status" text not null default 'pending', "decision_note" text null, "edited_draft" text null, "decided_at" text null, "executed_at" text null, "result" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_task_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_task_deleted_at" ON "agent_task" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_task_status" ON "agent_task" ("status") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "agent_setting" ("id" text not null, "key" text not null, "value" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "agent_setting_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_agent_setting_deleted_at" ON "agent_setting" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_agent_setting_key" ON "agent_setting" ("key") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "agent_setting" cascade;`);
    this.addSql(`drop table if exists "agent_task" cascade;`);
    this.addSql(`drop table if exists "agent_message" cascade;`);
    this.addSql(`drop table if exists "agent_conversation" cascade;`);
  }

}
