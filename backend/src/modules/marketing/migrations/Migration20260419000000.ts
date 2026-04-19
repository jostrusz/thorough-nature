import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Marketing Platform — Contact Intelligence layer
 *
 * Adds two things:
 *   1. Acquisition + rollup columns on marketing_contact (UTM, CAC, LTV,
 *      engagement metrics, RFM scores, lifecycle_stage, product affinity).
 *   2. New table marketing_attribution — one row per (email click → order)
 *      match within a 30-day last-click window, in common currency EUR.
 *
 * All new columns are nullable / defaulted so existing rows keep working.
 * No existing column is touched.
 */
export class Migration20260419000000 extends Migration {
  override async up(): Promise<void> {
    // ── marketing_contact: acquisition block ───────────────────────────────
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_source" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_medium" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_campaign" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_content" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_term" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_landing_url" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_referrer" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_form_id" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_lead_magnet" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_device" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_fbc" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_fbp" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_at" timestamptz null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "acquisition_cost_eur" numeric(14,4) null;`)

    // ── marketing_contact: purchase rollup (denormalized from attribution) ─
    this.addSql(`alter table "marketing_contact" add column if not exists "first_order_at" timestamptz null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "last_order_at" timestamptz null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "total_orders" integer not null default 0;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "total_revenue_eur" numeric(14,4) not null default 0;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "avg_order_value_eur" numeric(14,4) null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "email_attributed_orders" integer not null default 0;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "email_attributed_revenue_eur" numeric(14,4) not null default 0;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "first_purchase_source" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "days_to_first_purchase" integer null;`)

    // ── marketing_contact: engagement metrics ──────────────────────────────
    this.addSql(`alter table "marketing_contact" add column if not exists "last_email_sent_at" timestamptz null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "last_email_opened_at" timestamptz null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "last_email_clicked_at" timestamptz null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "emails_sent_total" integer not null default 0;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "emails_opened_total" integer not null default 0;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "emails_clicked_total" integer not null default 0;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "open_rate_30d" numeric(5,4) null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "click_rate_30d" numeric(5,4) null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "engagement_score" integer null;`)

    // ── marketing_contact: RFM ─────────────────────────────────────────────
    this.addSql(`alter table "marketing_contact" add column if not exists "rfm_recency" smallint null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "rfm_frequency" smallint null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "rfm_monetary" smallint null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "rfm_score" smallint null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "rfm_segment" text null;`)

    // ── marketing_contact: lifecycle + product affinity ────────────────────
    this.addSql(`alter table "marketing_contact" add column if not exists "lifecycle_stage" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "lifecycle_entered_at" timestamptz null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "primary_book" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "purchased_books" jsonb null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "category_affinity" jsonb null;`)

    // ── marketing_contact: deliverability ──────────────────────────────────
    this.addSql(`alter table "marketing_contact" add column if not exists "delivery_issues_count" integer not null default 0;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "last_bounce_type" text null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "complaint_at" timestamptz null;`)
    this.addSql(`alter table "marketing_contact" add column if not exists "computed_at" timestamptz null;`)

    // ── indices supporting segment queries ─────────────────────────────────
    this.addSql(`create index if not exists "IDX_marketing_contact_lifecycle_stage" on "marketing_contact" ("brand_id", "lifecycle_stage") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_contact_rfm" on "marketing_contact" ("brand_id", "rfm_score") where "deleted_at" is null and "rfm_score" is not null;`)
    this.addSql(`create index if not exists "IDX_marketing_contact_last_order_at" on "marketing_contact" ("brand_id", "last_order_at") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_contact_acquisition_campaign" on "marketing_contact" ("brand_id", "acquisition_campaign") where "deleted_at" is null and "acquisition_campaign" is not null;`)
    this.addSql(`create index if not exists "IDX_marketing_contact_engagement_score" on "marketing_contact" ("brand_id", "engagement_score") where "deleted_at" is null and "engagement_score" is not null;`)

    // ── marketing_attribution ──────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_attribution" (
        "id" text not null,
        "brand_id" text not null,
        "contact_id" text not null,
        "message_id" text null,
        "campaign_id" text null,
        "flow_id" text null,
        "flow_run_id" text null,
        "order_id" text not null,
        "order_display_id" text null,
        "click_at" timestamptz null,
        "order_placed_at" timestamptz not null,
        "attribution_window_hours" numeric(8,2) null,
        "attribution_model" text not null default 'last_click',
        "order_total" numeric(14,4) not null,
        "currency_code" text not null,
        "order_total_eur" numeric(14,4) null,
        "fx_rate_to_eur" numeric(14,8) null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_attribution_pkey" primary key ("id")
      );
    `)
    this.addSql(`create unique index if not exists "IDX_marketing_attribution_order_unique" on "marketing_attribution" ("order_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_attribution_brand_contact" on "marketing_attribution" ("brand_id", "contact_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_attribution_campaign" on "marketing_attribution" ("campaign_id") where "deleted_at" is null and "campaign_id" is not null;`)
    this.addSql(`create index if not exists "IDX_marketing_attribution_flow" on "marketing_attribution" ("flow_id") where "deleted_at" is null and "flow_id" is not null;`)
    this.addSql(`create index if not exists "IDX_marketing_attribution_message" on "marketing_attribution" ("message_id") where "deleted_at" is null and "message_id" is not null;`)
    this.addSql(`create index if not exists "IDX_marketing_attribution_deleted_at" on "marketing_attribution" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_fx_rate — daily EUR rate snapshot ────────────────────────
    // Populated lazily; FX util falls back to a hardcoded table when row missing.
    this.addSql(`
      create table if not exists "marketing_fx_rate" (
        "id" text not null,
        "currency_code" text not null,
        "rate_to_eur" numeric(14,8) not null,
        "as_of_date" date not null,
        "source" text null,
        "created_at" timestamptz not null default now(),
        constraint "marketing_fx_rate_pkey" primary key ("id")
      );
    `)
    this.addSql(`create unique index if not exists "IDX_marketing_fx_rate_date_currency" on "marketing_fx_rate" ("currency_code", "as_of_date");`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_fx_rate" cascade;`)
    this.addSql(`drop table if exists "marketing_attribution" cascade;`)

    const cols = [
      "acquisition_source","acquisition_medium","acquisition_campaign","acquisition_content","acquisition_term",
      "acquisition_landing_url","acquisition_referrer","acquisition_form_id","acquisition_lead_magnet",
      "acquisition_device","acquisition_fbc","acquisition_fbp","acquisition_at","acquisition_cost_eur",
      "first_order_at","last_order_at","total_orders","total_revenue_eur","avg_order_value_eur",
      "email_attributed_orders","email_attributed_revenue_eur","first_purchase_source","days_to_first_purchase",
      "last_email_sent_at","last_email_opened_at","last_email_clicked_at",
      "emails_sent_total","emails_opened_total","emails_clicked_total",
      "open_rate_30d","click_rate_30d","engagement_score",
      "rfm_recency","rfm_frequency","rfm_monetary","rfm_score","rfm_segment",
      "lifecycle_stage","lifecycle_entered_at","primary_book","purchased_books","category_affinity",
      "delivery_issues_count","last_bounce_type","complaint_at","computed_at",
    ]
    for (const c of cols) {
      this.addSql(`alter table "marketing_contact" drop column if exists "${c}";`)
    }
  }
}
