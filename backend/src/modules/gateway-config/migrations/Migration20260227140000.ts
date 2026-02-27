import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260227140000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "payment_method_config" add column if not exists "config" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "payment_method_config" drop column if exists "config";`);
  }

}
