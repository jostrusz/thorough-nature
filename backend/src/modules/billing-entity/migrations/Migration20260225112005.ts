import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260225112005 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "billing_entity" ("id" text not null, "name" text not null, "legal_name" text not null, "country_code" text not null, "tax_id" text null, "vat_id" text null, "registration_id" text null, "address" jsonb null, "bank_account" jsonb null, "logo_url" text null, "email" text null, "phone" text null, "website" text null, "is_default" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "billing_entity_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_billing_entity_deleted_at" ON "billing_entity" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "billing_entity" cascade;`);
  }

}
