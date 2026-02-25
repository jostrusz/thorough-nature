import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260225112010 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "gateway_config" ("id" text not null, "provider" text not null, "display_name" text not null, "billing_entity_id" text null, "mode" text check ("mode" in ('live', 'test')) not null default 'test', "live_keys" jsonb null, "test_keys" jsonb null, "supported_currencies" jsonb null, "priority" integer not null default 1, "is_active" boolean not null default false, "sales_channel_ids" jsonb null, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "gateway_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_gateway_config_deleted_at" ON "gateway_config" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "payment_method_config" ("id" text not null, "code" text not null, "display_name" text not null, "icon" text null, "available_countries" jsonb null, "supported_currencies" jsonb null, "is_active" boolean not null default true, "sort_order" integer not null default 0, "gateway_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "payment_method_config_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_method_config_gateway_id" ON "payment_method_config" ("gateway_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_payment_method_config_deleted_at" ON "payment_method_config" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "payment_method_config" add constraint "payment_method_config_gateway_id_foreign" foreign key ("gateway_id") references "gateway_config" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "payment_method_config" drop constraint if exists "payment_method_config_gateway_id_foreign";`);

    this.addSql(`drop table if exists "gateway_config" cascade;`);

    this.addSql(`drop table if exists "payment_method_config" cascade;`);
  }

}
