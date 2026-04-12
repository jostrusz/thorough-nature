import { Migration } from "@medusajs/framework/mikro-orm/migrations"

/**
 * Marketing Platform — Phase 0 — initial schema
 *
 * Creates all tables for the new marketing module. Completely isolated from
 * the existing email-notifications module, its templates, and all transactional
 * subscribers. Nothing here touches any pre-existing table or column.
 */
export class Migration20260411000000 extends Migration {
  override async up(): Promise<void> {
    // ── marketing_brand ───────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_brand" (
        "id" text not null,
        "slug" text not null,
        "display_name" text not null,
        "project_id" text not null,
        "storefront_domain" text null,
        "marketing_from_email" text not null,
        "marketing_from_name" text not null,
        "marketing_reply_to" text null,
        "resend_api_key_encrypted" text null,
        "resend_domain_id" text null,
        "resend_audience_id" text null,
        "primary_color" text null,
        "logo_url" text null,
        "locale" text not null default 'nl',
        "timezone" text not null default 'Europe/Amsterdam',
        "double_opt_in_enabled" boolean not null default false,
        "tracking_enabled" boolean not null default true,
        "brand_voice_profile" jsonb null,
        "abandoned_cart_owner" text not null default 'transactional_legacy',
        "enabled" boolean not null default true,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_brand_pkey" primary key ("id")
      );
    `)
    this.addSql(`create unique index if not exists "IDX_marketing_brand_slug_unique" on "marketing_brand" ("slug") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_brand_project_id" on "marketing_brand" ("project_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_brand_deleted_at" on "marketing_brand" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_contact ─────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_contact" (
        "id" text not null,
        "brand_id" text not null,
        "email" text not null,
        "phone" text null,
        "first_name" text null,
        "last_name" text null,
        "locale" text null,
        "country_code" text null,
        "timezone" text null,
        "status" text not null default 'unconfirmed',
        "source" text null,
        "consent_version" text null,
        "consent_ip" text null,
        "consent_user_agent" text null,
        "consent_at" timestamptz null,
        "unsubscribed_at" timestamptz null,
        "external_id" text null,
        "properties" jsonb null,
        "computed" jsonb null,
        "tags" jsonb null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_contact_pkey" primary key ("id")
      );
    `)
    this.addSql(`create unique index if not exists "IDX_marketing_contact_brand_email" on "marketing_contact" ("brand_id", lower("email")) where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_contact_brand_status" on "marketing_contact" ("brand_id", "status") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_contact_external_id" on "marketing_contact" ("external_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_contact_deleted_at" on "marketing_contact" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_list ────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_list" (
        "id" text not null,
        "brand_id" text not null,
        "name" text not null,
        "description" text null,
        "type" text not null default 'static',
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_list_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_list_brand_id" on "marketing_list" ("brand_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_list_deleted_at" on "marketing_list" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_list_membership ─────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_list_membership" (
        "id" text not null,
        "list_id" text not null,
        "contact_id" text not null,
        "brand_id" text not null,
        "source" text null,
        "added_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_list_membership_pkey" primary key ("id")
      );
    `)
    this.addSql(`create unique index if not exists "IDX_marketing_list_membership_list_contact" on "marketing_list_membership" ("list_id", "contact_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_list_membership_contact_id" on "marketing_list_membership" ("contact_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_list_membership_deleted_at" on "marketing_list_membership" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_segment ─────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_segment" (
        "id" text not null,
        "brand_id" text not null,
        "name" text not null,
        "description" text null,
        "query" jsonb not null,
        "is_suppression" boolean not null default false,
        "cached_count" integer null,
        "cached_at" timestamptz null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_segment_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_segment_brand_id" on "marketing_segment" ("brand_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_segment_deleted_at" on "marketing_segment" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_template ────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_template" (
        "id" text not null,
        "brand_id" text not null,
        "name" text not null,
        "subject" text not null,
        "preheader" text not null default '',
        "from_name" text null,
        "from_email" text null,
        "reply_to" text null,
        "block_json" jsonb null,
        "custom_html" text null,
        "compiled_html" text null,
        "compiled_text" text null,
        "editor_type" text not null default 'blocks',
        "version" integer not null default 1,
        "status" text not null default 'draft',
        "brand_voice_used" boolean not null default false,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_template_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_template_brand_id" on "marketing_template" ("brand_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_template_deleted_at" on "marketing_template" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_template_version ────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_template_version" (
        "id" text not null,
        "template_id" text not null,
        "brand_id" text not null,
        "version" integer not null,
        "subject" text not null,
        "preheader" text not null default '',
        "from_name" text null,
        "from_email" text null,
        "reply_to" text null,
        "block_json" jsonb null,
        "custom_html" text null,
        "compiled_html" text null,
        "compiled_text" text null,
        "editor_type" text not null default 'blocks',
        "created_by" text null,
        "changelog" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_template_version_pkey" primary key ("id")
      );
    `)
    this.addSql(`create unique index if not exists "IDX_marketing_template_version_template_version" on "marketing_template_version" ("template_id", "version") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_template_version_deleted_at" on "marketing_template_version" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_campaign ────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_campaign" (
        "id" text not null,
        "brand_id" text not null,
        "name" text not null,
        "template_id" text not null,
        "template_version" integer null,
        "list_id" text null,
        "segment_id" text null,
        "suppression_segment_ids" jsonb null,
        "send_at" timestamptz null,
        "sent_at" timestamptz null,
        "status" text not null default 'draft',
        "metrics" jsonb null,
        "ab_test" jsonb null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_campaign_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_campaign_brand_status" on "marketing_campaign" ("brand_id", "status") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_campaign_deleted_at" on "marketing_campaign" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_flow ────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_flow" (
        "id" text not null,
        "brand_id" text not null,
        "name" text not null,
        "description" text null,
        "trigger" jsonb not null,
        "definition" jsonb not null,
        "status" text not null default 'draft',
        "version" integer not null default 1,
        "stats" jsonb null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_flow_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_flow_brand_status" on "marketing_flow" ("brand_id", "status") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_flow_deleted_at" on "marketing_flow" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_flow_run ────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_flow_run" (
        "id" text not null,
        "flow_id" text not null,
        "brand_id" text not null,
        "contact_id" text not null,
        "current_node_id" text null,
        "state" text not null default 'running',
        "started_at" timestamptz not null,
        "next_run_at" timestamptz null,
        "context" jsonb null,
        "completed_at" timestamptz null,
        "error" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_flow_run_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_flow_run_flow_contact" on "marketing_flow_run" ("flow_id", "contact_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_flow_run_next_run_at" on "marketing_flow_run" ("next_run_at") where "deleted_at" is null and "state" in ('waiting','running');`)
    this.addSql(`create index if not exists "IDX_marketing_flow_run_deleted_at" on "marketing_flow_run" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_event ───────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_event" (
        "id" text not null,
        "brand_id" text not null,
        "contact_id" text null,
        "email" text null,
        "type" text not null,
        "payload" jsonb null,
        "occurred_at" timestamptz not null,
        "processed_at" timestamptz null,
        "source" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_event_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_event_brand_type_time" on "marketing_event" ("brand_id", "type", "occurred_at" desc) where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_event_contact" on "marketing_event" ("contact_id", "occurred_at" desc) where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_event_email" on "marketing_event" (lower("email")) where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_event_deleted_at" on "marketing_event" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_message ─────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_message" (
        "id" text not null,
        "brand_id" text not null,
        "contact_id" text null,
        "campaign_id" text null,
        "flow_id" text null,
        "flow_run_id" text null,
        "template_id" text null,
        "template_version" integer null,
        "resend_email_id" text null,
        "subject_snapshot" text null,
        "to_email" text not null,
        "from_email" text not null,
        "status" text not null default 'queued',
        "sent_at" timestamptz null,
        "delivered_at" timestamptz null,
        "first_opened_at" timestamptz null,
        "first_clicked_at" timestamptz null,
        "bounced_at" timestamptz null,
        "complained_at" timestamptz null,
        "bounce_reason" text null,
        "opens_count" integer not null default 0,
        "clicks_count" integer not null default 0,
        "error" text null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_message_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_message_brand_status" on "marketing_message" ("brand_id", "status") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_message_contact" on "marketing_message" ("contact_id") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_message_campaign" on "marketing_message" ("campaign_id") where "deleted_at" is null and "campaign_id" is not null;`)
    this.addSql(`create index if not exists "IDX_marketing_message_resend_id" on "marketing_message" ("resend_email_id") where "deleted_at" is null and "resend_email_id" is not null;`)
    this.addSql(`create index if not exists "IDX_marketing_message_deleted_at" on "marketing_message" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_suppression ─────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_suppression" (
        "id" text not null,
        "brand_id" text not null,
        "email" text not null,
        "reason" text not null,
        "source_message_id" text null,
        "suppressed_at" timestamptz not null,
        "metadata" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_suppression_pkey" primary key ("id")
      );
    `)
    this.addSql(`create unique index if not exists "IDX_marketing_suppression_brand_email" on "marketing_suppression" ("brand_id", lower("email")) where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_suppression_deleted_at" on "marketing_suppression" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_form ────────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_form" (
        "id" text not null,
        "brand_id" text not null,
        "slug" text not null,
        "name" text not null,
        "type" text not null default 'popup',
        "config" jsonb null,
        "styling" jsonb null,
        "custom_html" text null,
        "custom_css" text null,
        "fields" jsonb null,
        "preheader" text null,
        "success_action" jsonb null,
        "target_list_ids" jsonb null,
        "target_segment_id" text null,
        "double_opt_in" boolean null,
        "consent_text" text null,
        "status" text not null default 'draft',
        "metrics" jsonb null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_form_pkey" primary key ("id")
      );
    `)
    this.addSql(`create unique index if not exists "IDX_marketing_form_brand_slug" on "marketing_form" ("brand_id", "slug") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_form_deleted_at" on "marketing_form" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_consent_log ─────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_consent_log" (
        "id" text not null,
        "brand_id" text not null,
        "contact_id" text null,
        "email" text null,
        "email_hash" text null,
        "action" text not null,
        "source" text null,
        "consent_text_snapshot" text null,
        "ip_address" text null,
        "user_agent" text null,
        "occurred_at" timestamptz not null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_consent_log_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_consent_log_brand_email" on "marketing_consent_log" ("brand_id", "email_hash") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_consent_log_contact" on "marketing_consent_log" ("contact_id") where "deleted_at" is null and "contact_id" is not null;`)
    this.addSql(`create index if not exists "IDX_marketing_consent_log_deleted_at" on "marketing_consent_log" ("deleted_at") where "deleted_at" is null;`)

    // ── marketing_ai_job ──────────────────────────────────────────────────
    this.addSql(`
      create table if not exists "marketing_ai_job" (
        "id" text not null,
        "brand_id" text not null,
        "type" text not null,
        "input" jsonb null,
        "output" jsonb null,
        "model" text null,
        "tokens_in" integer null,
        "tokens_out" integer null,
        "status" text not null default 'queued',
        "error" text null,
        "created_at" timestamptz not null default now(),
        "updated_at" timestamptz not null default now(),
        "deleted_at" timestamptz null,
        constraint "marketing_ai_job_pkey" primary key ("id")
      );
    `)
    this.addSql(`create index if not exists "IDX_marketing_ai_job_brand_status" on "marketing_ai_job" ("brand_id", "status") where "deleted_at" is null;`)
    this.addSql(`create index if not exists "IDX_marketing_ai_job_deleted_at" on "marketing_ai_job" ("deleted_at") where "deleted_at" is null;`)
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "marketing_ai_job" cascade;`)
    this.addSql(`drop table if exists "marketing_consent_log" cascade;`)
    this.addSql(`drop table if exists "marketing_form" cascade;`)
    this.addSql(`drop table if exists "marketing_suppression" cascade;`)
    this.addSql(`drop table if exists "marketing_message" cascade;`)
    this.addSql(`drop table if exists "marketing_event" cascade;`)
    this.addSql(`drop table if exists "marketing_flow_run" cascade;`)
    this.addSql(`drop table if exists "marketing_flow" cascade;`)
    this.addSql(`drop table if exists "marketing_campaign" cascade;`)
    this.addSql(`drop table if exists "marketing_template_version" cascade;`)
    this.addSql(`drop table if exists "marketing_template" cascade;`)
    this.addSql(`drop table if exists "marketing_segment" cascade;`)
    this.addSql(`drop table if exists "marketing_list_membership" cascade;`)
    this.addSql(`drop table if exists "marketing_list" cascade;`)
    this.addSql(`drop table if exists "marketing_contact" cascade;`)
    this.addSql(`drop table if exists "marketing_brand" cascade;`)
  }
}
