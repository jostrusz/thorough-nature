import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260226120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "gateway_config" add column if not exists "project_slugs" jsonb null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`alter table if exists "gateway_config" drop column if exists "project_slugs";`);
  }

}
