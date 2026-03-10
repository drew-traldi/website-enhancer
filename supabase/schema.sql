-- ============================================================
-- Website Enhancer — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- ENUM TYPES
-- ============================================================

CREATE TYPE rebuild_status AS ENUM ('queued', 'building', 'deployed', 'failed');
CREATE TYPE outreach_contact_method AS ENUM ('email', 'manual_email', 'in_person', 'phone', 'skipped');
CREATE TYPE outreach_status AS ENUM ('draft', 'sent', 'opened', 'clicked', 'replied', 'converted', 'skipped');

-- ============================================================
-- TABLE: executives
-- ============================================================
CREATE TABLE IF NOT EXISTS executives (
  id        TEXT PRIMARY KEY,            -- D, S, E, I
  full_name TEXT NOT NULL,
  title     TEXT NOT NULL,
  email     TEXT NOT NULL,
  phone     TEXT,
  pin_hash  TEXT NOT NULL,               -- hashed PIN
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: cities
-- ============================================================
CREATE TABLE IF NOT EXISTS cities (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                    TEXT NOT NULL,
  state                   TEXT NOT NULL,
  lat                     FLOAT,
  lng                     FLOAT,
  last_run_at             TIMESTAMPTZ,
  total_businesses_found  INT DEFAULT 0,
  batches_completed       INT DEFAULT 0,
  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(name, state)
);

-- ============================================================
-- TABLE: businesses
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  city_id               UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  place_id              TEXT UNIQUE NOT NULL,    -- Google Place ID
  name                  TEXT NOT NULL,
  address               TEXT,
  phone                 TEXT,
  website               TEXT,
  google_rating         FLOAT,
  google_review_count   INT DEFAULT 0,
  latest_review_date    DATE,
  business_types        TEXT[],
  photos                JSONB,
  hours                 JSONB,
  is_chain              BOOLEAN DEFAULT FALSE,
  chain_location_count  INT,
  is_active             BOOLEAN DEFAULT TRUE,
  filter_status         TEXT,                   -- pass | fail:<reason>
  status                TEXT DEFAULT 'discovered',
  -- Status values: discovered, filtered, scored, queued_for_rebuild,
  --                rebuilding, rebuilt, email_sent, manual_required,
  --                responded, converted, skipped
  assigned_executive    TEXT REFERENCES executives(id),
  discovered_at         TIMESTAMPTZ DEFAULT NOW(),
  batch_number          INT DEFAULT 1
);

CREATE INDEX idx_businesses_city_id  ON businesses(city_id);
CREATE INDEX idx_businesses_place_id ON businesses(place_id);
CREATE INDEX idx_businesses_status   ON businesses(status);

-- ============================================================
-- TABLE: website_scores
-- ============================================================
CREATE TABLE IF NOT EXISTS website_scores (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id             UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  overall_score           FLOAT,
  responsive_score        FLOAT,
  visual_era_score        FLOAT,
  performance_score       FLOAT,
  security_score          FLOAT,
  accessibility_score     FLOAT,
  tech_stack_score        FLOAT,
  content_quality_score   FLOAT,
  ux_score                FLOAT,
  details                 JSONB,               -- full breakdown data
  screenshot_before_url   TEXT,                -- Supabase Storage URL
  scored_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_website_scores_business_id ON website_scores(business_id);

-- ============================================================
-- TABLE: rebuilds
-- ============================================================
CREATE TABLE IF NOT EXISTS rebuilds (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id           UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  github_repo_url       TEXT,
  live_demo_url         TEXT,
  screenshot_after_url  TEXT,
  design_brief          JSONB,
  status                rebuild_status DEFAULT 'queued',
  built_at              TIMESTAMPTZ,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rebuilds_business_id ON rebuilds(business_id);

-- ============================================================
-- TABLE: outreach
-- ============================================================
CREATE TABLE IF NOT EXISTS outreach (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id          UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  rebuild_id           UUID REFERENCES rebuilds(id),
  executive_id         TEXT REFERENCES executives(id),
  contact_email        TEXT,
  contact_method       outreach_contact_method DEFAULT 'email',
  email_subject        TEXT,
  email_body           TEXT,
  sendgrid_message_id  TEXT,
  sent_at              TIMESTAMPTZ,
  opened_at            TIMESTAMPTZ,
  clicked_at           TIMESTAMPTZ,
  bounced              BOOLEAN DEFAULT FALSE,
  status               outreach_status DEFAULT 'draft',
  notes                TEXT,
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_outreach_business_id ON outreach(business_id);
CREATE INDEX idx_outreach_status      ON outreach(status);

-- ============================================================
-- SEED: Executive Profiles
-- PIN 2468 — stored as bcrypt hash
-- (actual hash generated by the seed script, placeholder here)
-- ============================================================
INSERT INTO executives (id, full_name, title, email, phone, pin_hash) VALUES
  ('D', 'Drew',           'CEO / Head of Client Relations', 'drew@haiconsultingservices.com',     NULL, 'PLACEHOLDER'),
  ('S', 'Savannah Owens', 'Chief Revenue Officer',          'savannah@haiconsultingservices.com', NULL, 'PLACEHOLDER'),
  ('E', 'Elliot Kinney',  'Chief Operating Officer',        'elliot@haiconsultingservices.com',   NULL, 'PLACEHOLDER'),
  ('I', 'Ian Kinney',     'Chief Information Officer',      'ian@haiconsultingservices.com',      NULL, 'PLACEHOLDER')
ON CONFLICT (id) DO NOTHING;
