-- ===========================================================================
-- Vitals — database schema (PostgreSQL / Supabase)
-- Run this once in the Supabase SQL Editor before starting the app.
--
-- Phase 1 actively uses: profile.
-- Phase 2 actively uses: food_log, food_item.
-- The remaining tables are created now so later phases (sync, bio-age) have a
-- stable foundation. They mirror the data model in the Architecture &
-- Methodology spec, Section 5.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- profile — single-user biometrics. One row, keyed 'me'.
-- ---------------------------------------------------------------------------
create table if not exists profile (
  id              text primary key default 'me',
  name            text,
  age             integer,
  sex             text check (sex in ('male', 'female')),
  height_cm       numeric,
  weight_kg       numeric,
  body_fat_pct    numeric,                       -- null until a body-comp scan is on file
  activity_level  text default 'moderate'
                    check (activity_level in
                      ('sedentary','light','moderate','active','very_active')),
  bmr_override    integer,                       -- user's manual BMR; null = compute it
  energy_goal     text default 'deficit'
                    check (energy_goal in ('deficit','maintenance','surplus')),
  energy_adjust   integer default 400,           -- kcal/day magnitude for deficit/surplus
  updated_at      timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- derived_target — versioned snapshots of computed BMR / TDEE / targets.
-- ---------------------------------------------------------------------------
create table if not exists derived_target (
  id            bigint generated always as identity primary key,
  profile_id    text references profile(id) default 'me',
  bmr           integer,
  bmr_method    text,
  tdee          integer,
  target_kcal   integer,
  protein_g     integer,
  carbs_g       integer,
  fat_g         integer,
  computed_at   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- daily_metric — one row per day per metric, synced from Health Connect.
-- ---------------------------------------------------------------------------
create table if not exists daily_metric (
  id          bigint generated always as identity primary key,
  metric_date date not null,
  metric      text not null,        -- steps | active_kcal | total_kcal | rhr | hrv
  value       numeric not null,
  source      text default 'health_connect',
  synced_at   timestamptz default now(),
  unique (metric_date, metric)
);

-- ---------------------------------------------------------------------------
-- sleep_session — one night of sleep with per-stage durations (minutes).
-- ---------------------------------------------------------------------------
create table if not exists sleep_session (
  id           bigint generated always as identity primary key,
  night_date   date not null unique,
  start_at     timestamptz,
  end_at       timestamptz,
  total_min    integer,
  deep_min     integer,
  rem_min      integer,
  light_min    integer,
  awake_min    integer,
  score        integer
);

-- ---------------------------------------------------------------------------
-- food_log / food_item — meals logged through the AI assistant.
-- ---------------------------------------------------------------------------
create table if not exists food_log (
  id           bigint generated always as identity primary key,
  logged_for   date not null,
  meal         text,                 -- breakfast | lunch | dinner | snack
  raw_text     text,                 -- the user's natural-language description
  created_at   timestamptz default now()
);

create table if not exists food_item (
  id            bigint generated always as identity primary key,
  food_log_id   bigint references food_log(id) on delete cascade,
  name          text,
  source        text,                -- 'IFCT_2017' (Indian) | 'USDA_FDC' | 'estimate'
  quantity      text,                -- human-readable portion, e.g. '2 medium rotis'
  calories      numeric,
  protein_g     numeric,
  carbs_g       numeric,
  fat_g         numeric,
  fiber_g       numeric,
  micros        jsonb                 -- { "iron_mg": 3.1, "vitamin_d_iu": 200, ... }
);

-- ---------------------------------------------------------------------------
-- medical_document — uploaded reports + the values extracted from them.
-- ---------------------------------------------------------------------------
create table if not exists medical_document (
  id              bigint generated always as identity primary key,
  doc_type        text,              -- dexa | blood_panel | bmi | other
  file_path       text,              -- path in Supabase Storage
  effective_date  date,
  extracted       jsonb,             -- structured values pulled by the AI
  uploaded_at     timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- personalisation — how a document changed the user's stored physiology.
-- ---------------------------------------------------------------------------
create table if not exists personalisation (
  id            bigint generated always as identity primary key,
  source_doc    bigint references medical_document(id),
  field         text,                -- e.g. 'bmr' | 'body_fat_pct' | 'iron_target'
  old_value     text,
  new_value     text,
  applied_at    timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- bio_age_snapshot — dated biological-age estimate + per-input contributions.
-- ---------------------------------------------------------------------------
create table if not exists bio_age_snapshot (
  id              bigint generated always as identity primary key,
  snapshot_date   date not null unique,
  bio_age         numeric,
  chronological   numeric,
  contributions   jsonb,             -- { "hrv": -1.1, "rhr": -0.8, ... }
  created_at      timestamptz default now()
);

-- Seed the single profile row so the app always has something to read.
insert into profile (id, name) values ('me', 'Jay')
on conflict (id) do nothing;
