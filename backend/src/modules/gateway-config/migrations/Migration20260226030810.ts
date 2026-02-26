import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260226030810 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "gateway_config" add column if not exists "statement_descriptor" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "gateway_config" drop column if exists "statement_descriptor";`);
  }

}
