import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260316120000 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`ALTER TABLE "dextrum_config" ADD COLUMN IF NOT EXISTS "default_delivery_method_id" text null;`);
    this.addSql(`ALTER TABLE "dextrum_config" ADD COLUMN IF NOT EXISTS "default_pickup_delivery_method_id" text null;`);
    this.addSql(`ALTER TABLE "dextrum_config" ADD COLUMN IF NOT EXISTS "default_payment_method_cod" text null;`);
    this.addSql(`ALTER TABLE "dextrum_config" ADD COLUMN IF NOT EXISTS "default_payment_method_paid" text null;`);
  }

  override async down(): Promise<void> {
    this.addSql(`ALTER TABLE "dextrum_config" DROP COLUMN IF EXISTS "default_delivery_method_id";`);
    this.addSql(`ALTER TABLE "dextrum_config" DROP COLUMN IF EXISTS "default_pickup_delivery_method_id";`);
    this.addSql(`ALTER TABLE "dextrum_config" DROP COLUMN IF EXISTS "default_payment_method_cod";`);
    this.addSql(`ALTER TABLE "dextrum_config" DROP COLUMN IF EXISTS "default_payment_method_paid";`);
  }
}
