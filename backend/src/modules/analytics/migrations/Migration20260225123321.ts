import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20260225123321 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`create table if not exists "analytics_conversion_event" ("id" text not null, "project_id" text not null, "session_id" text not null, "visitor_id" text not null, "event_type" text not null, "event_data" jsonb null, "page_url" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_conversion_event_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_conversion_event_deleted_at" ON "analytics_conversion_event" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "analytics_customer_journey" ("id" text not null, "project_id" text not null, "visitor_id" text not null, "order_id" text null, "touchpoints" jsonb not null, "first_touch_source" text null, "first_touch_medium" text null, "last_touch_source" text null, "last_touch_medium" text null, "total_touchpoints" integer not null default 0, "total_sessions" integer not null default 0, "days_to_conversion" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_customer_journey_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_customer_journey_deleted_at" ON "analytics_customer_journey" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "analytics_email_campaign" ("id" text not null, "project_id" text not null, "email_name" text not null, "email_subject" text null, "email_type" text null, "sent_count" integer not null default 0, "delivered_count" integer not null default 0, "bounced_count" integer not null default 0, "opened_count" integer not null default 0, "clicked_count" integer not null default 0, "unsubscribed_count" integer not null default 0, "conversion_count" integer not null default 0, "revenue" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_email_campaign_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_email_campaign_deleted_at" ON "analytics_email_campaign" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "analytics_email_conversion" ("id" text not null, "email_campaign_id" text not null, "customer_email" text not null, "order_id" text null, "order_amount" integer not null default 0, "clicked_link" text null, "time_to_conversion" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_email_conversion_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_email_conversion_deleted_at" ON "analytics_email_conversion" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "analytics_page_view" ("id" text not null, "project_id" text not null, "session_id" text not null, "visitor_id" text not null, "page_url" text not null, "page_path" text not null, "referrer" text null, "utm_source" text null, "utm_medium" text null, "utm_campaign" text null, "utm_content" text null, "utm_term" text null, "traffic_source" text null, "traffic_medium" text null, "device_type" text null, "browser" text null, "os" text null, "country" text null, "ip_address" text null, "fbclid" text null, "fbc" text null, "fbp" text null, "time_on_page" integer not null default 0, "scroll_depth" integer not null default 0, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_page_view_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_page_view_deleted_at" ON "analytics_page_view" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`create table if not exists "analytics_visitor_session" ("id" text not null, "project_id" text not null, "visitor_id" text not null, "session_id" text not null, "first_page_url" text null, "last_page_url" text null, "utm_source" text null, "utm_medium" text null, "utm_campaign" text null, "utm_content" text null, "utm_term" text null, "traffic_source" text null, "traffic_medium" text null, "device_type" text null, "browser" text null, "os" text null, "country" text null, "pages_viewed" integer not null default 1, "duration_seconds" integer not null default 0, "is_bounce" boolean not null default true, "has_conversion" boolean not null default false, "conversion_type" text null, "order_id" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "analytics_visitor_session_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_analytics_visitor_session_deleted_at" ON "analytics_visitor_session" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "analytics_conversion_event" cascade;`);

    this.addSql(`drop table if exists "analytics_customer_journey" cascade;`);

    this.addSql(`drop table if exists "analytics_email_campaign" cascade;`);

    this.addSql(`drop table if exists "analytics_email_conversion" cascade;`);

    this.addSql(`drop table if exists "analytics_page_view" cascade;`);

    this.addSql(`drop table if exists "analytics_visitor_session" cascade;`);
  }

}
