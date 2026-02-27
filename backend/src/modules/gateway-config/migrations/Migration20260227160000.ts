import { Migration } from "@medusajs/framework/mikro-orm/migrations";

/**
 * Consolidated migration to add all missing columns to gateway_config and payment_method_config.
 * Uses IF NOT EXISTS to be safe if some columns already exist.
 */
export class Migration20260227160000 extends Migration {

  override async up(): Promise<void> {
    // Add statement_descriptor if missing
    this.addSql(`alter table if exists "gateway_config" add column if not exists "statement_descriptor" text null;`);
    // Add project_slugs if missing
    this.addSql(`alter table if exists "gateway_config" add column if not exists "project_slugs" jsonb null;`);
    // Add config to payment_method_config if missing
    this.addSql(`alter table if exists "payment_method_config" add column if not exists "config" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "gateway_config" drop column if exists "project_slugs";`);
    this.addSql(`alter table if exists "gateway_config" drop column if exists "statement_descriptor";`);
    this.addSql(`alter table if exists "payment_method_config" drop column if exists "config";`);
  }

}
