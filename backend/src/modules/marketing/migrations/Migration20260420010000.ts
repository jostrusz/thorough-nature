import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Add compliance_footer_html to marketing_brand.
 *
 * Dispatcher injects this block before </body> when the user's campaign
 * HTML does not already include an unsubscribe placeholder. Guarantees
 * every outgoing marketing email carries the legally required disclosures:
 *   - company identification (name, registration ID, VAT)
 *   - physical address
 *   - contact email
 *   - unsubscribe link
 *   - reason-for-receipt statement
 *   - privacy policy link
 *
 * Interpolated at send-time (supports {{ unsubscribe_url }}, {$unsubscribe},
 * ${unsubscribe_url}, <%= unsubscribe_url %>).
 */
export class Migration20260420010000 extends Migration {
  override async up(): Promise<void> {
    this.addSql(`alter table "marketing_brand" add column if not exists "compliance_footer_html" text null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`alter table "marketing_brand" drop column if exists "compliance_footer_html";`)
  }
}
