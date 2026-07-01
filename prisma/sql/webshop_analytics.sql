-- Webshop-analytics tabellen (Fase A/B/C) voor de PRODUCTIE-database.
-- Idempotent: veilig om nogmaals te draaien. Toepassen op crm.distrixs.nl, bijv.:
--   docker compose exec -T db psql -U <user> -d <db> < prisma/sql/webshop_analytics.sql
-- Gebruik dit i.p.v. `prisma migrate dev` (dat faalt op de bestaande migratie-historie).

-- ── Enum ────────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "WebshopLinkStatus" AS ENUM ('UNLINKED', 'SUGGESTED', 'CONFIRMED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tabellen ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "webshop_accounts" (
  "id"            TEXT PRIMARY KEY,
  "wc_user_id"    INTEGER NOT NULL,
  "email"         TEXT,
  "display_name"  TEXT,
  "customer_id"   TEXT,
  "contact_id"    TEXT,
  "link_status"   "WebshopLinkStatus" NOT NULL DEFAULT 'UNLINKED',
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "analytics_visitors" (
  "id"            TEXT PRIMARY KEY,
  "vid"           TEXT NOT NULL,
  "account_id"    TEXT,
  "user_agent"    TEXT,
  "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_seen_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "analytics_sessions" (
  "id"            TEXT PRIMARY KEY,
  "visitor_id"    TEXT NOT NULL,
  "landing_path"  TEXT,
  "referrer"      TEXT,
  "utm_source"    TEXT,
  "utm_medium"    TEXT,
  "utm_campaign"  TEXT,
  "utm_content"   TEXT,
  "utm_term"      TEXT,
  "device"        TEXT,
  "started_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "last_event_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id"          TEXT PRIMARY KEY,
  "session_id"  TEXT NOT NULL,
  "visitor_id"  TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "path"        TEXT,
  "title"       TEXT,
  "product_sku" TEXT,
  "metadata"    JSONB,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ── Indexen ─────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "webshop_accounts_wc_user_id_key" ON "webshop_accounts" ("wc_user_id");
CREATE INDEX IF NOT EXISTS "webshop_accounts_customer_id_idx" ON "webshop_accounts" ("customer_id");
CREATE INDEX IF NOT EXISTS "webshop_accounts_contact_id_idx"  ON "webshop_accounts" ("contact_id");
CREATE UNIQUE INDEX IF NOT EXISTS "analytics_visitors_vid_key" ON "analytics_visitors" ("vid");
CREATE INDEX IF NOT EXISTS "analytics_visitors_account_id_idx" ON "analytics_visitors" ("account_id");
CREATE INDEX IF NOT EXISTS "analytics_sessions_visitor_id_idx"  ON "analytics_sessions" ("visitor_id");
CREATE INDEX IF NOT EXISTS "analytics_sessions_started_at_idx"  ON "analytics_sessions" ("started_at");
CREATE INDEX IF NOT EXISTS "analytics_sessions_utm_campaign_idx" ON "analytics_sessions" ("utm_campaign");
CREATE INDEX IF NOT EXISTS "analytics_events_session_id_idx"  ON "analytics_events" ("session_id");
CREATE INDEX IF NOT EXISTS "analytics_events_visitor_id_idx"  ON "analytics_events" ("visitor_id");
CREATE INDEX IF NOT EXISTS "analytics_events_type_idx"        ON "analytics_events" ("type");
CREATE INDEX IF NOT EXISTS "analytics_events_occurred_at_idx" ON "analytics_events" ("occurred_at");

-- ── Foreign keys (idempotent) ───────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE "webshop_accounts" ADD CONSTRAINT "webshop_accounts_customer_id_fkey"
    FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "webshop_accounts" ADD CONSTRAINT "webshop_accounts_contact_id_fkey"
    FOREIGN KEY ("contact_id") REFERENCES "customer_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "analytics_visitors" ADD CONSTRAINT "analytics_visitors_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "webshop_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "analytics_sessions" ADD CONSTRAINT "analytics_sessions_visitor_id_fkey"
    FOREIGN KEY ("visitor_id") REFERENCES "analytics_visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_session_id_fkey"
    FOREIGN KEY ("session_id") REFERENCES "analytics_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "analytics_events" ADD CONSTRAINT "analytics_events_visitor_id_fkey"
    FOREIGN KEY ("visitor_id") REFERENCES "analytics_visitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
