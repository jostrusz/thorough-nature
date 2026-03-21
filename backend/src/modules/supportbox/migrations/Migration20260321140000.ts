import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260321140000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "supportbox_message" ADD COLUMN IF NOT EXISTS "delivery_status" text NULL;`);
    this.addSql(`ALTER TABLE "supportbox_message" ADD COLUMN IF NOT EXISTS "delivery_status_at" text NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "supportbox_message" DROP COLUMN IF EXISTS "delivery_status";`);
    this.addSql(`ALTER TABLE "supportbox_message" DROP COLUMN IF EXISTS "delivery_status_at";`);
  }

}
