# Vityl — Phases 1–5

A consolidated, science-grounded health dashboard. This repository covers the
**Phase 1** build (app skeleton, calculation engine, Profile screen), the
**Phase 2** build (the AI nutrition assistant) and the **Phase 3** build
(activity sync and the Activity screen).

Later phases add medical-document ingestion and the biological-age engine. See
the *Architecture & Methodology Specification* for the full plan.

---

## What works

- **Today dashboard** — the home screen: your estimated **biological age** with a per-marker breakdown and trend, then calorie balance, macros, sleep and activity.
- **Profile screen** — age, sex, height, weight, body-fat %, activity level and
  energy goal; everything saves to Postgres.
- **Calculation engine** — BMR (Mifflin-St Jeor, or Katch-McArdle when body
  composition is known), TDEE, calorie target, and protein / carb / fat targets.
- **Editable BMR**, **energy goal** (deficit / maintenance / surplus) with a
  projected weekly weight change.
- **Nutrition AI** — describe a meal in plain language; the Claude-powered
  assistant **searches the web** for each item's nutrition data (USDA, IFCT
  2017, brand labels), cross-checks it, and returns calories, macros, fibre and
  micronutrients. Today's totals roll up against your targets.
- **Today's Meals** — an editable record of everything logged, grouped into
  breakfast / lunch / dinner / snacks; correct any number or remove an item
  in place.
- **Activity screen** — steps, active calories, resting heart rate, HRV and
  sleep, plus a 7-day calorie intake-vs-burn trend. Data arrives through the
  `/api/sync` ingest endpoint.
- **Password gate** — a single passphrase protects the whole app (the
  `/api/sync` endpoint is exempt; it uses its own token instead).

Every destination — Today, Nutrition AI, Activity and Profile — is live.
The Today dashboard is the app's home screen.

---

## Tech stack

| Layer        | Choice                                  |
|--------------|------------------------------------------|
| Framework    | Next.js 14 (App Router) + TypeScript     |
| Database     | PostgreSQL via Supabase                  |
| AI           | Claude API (@anthropic-ai/sdk) + web search |
| Hosting      | Vercel                                   |
| Styling      | Plain CSS with the design tokens from the approved mockup |

---

## Setup

You need **Node.js 18.18+** installed.

### 1. Install dependencies

```bash
npm install
```

### 2. Create the database (Supabase)

1. Create a free project at <https://supabase.com>.
2. In the dashboard, open **SQL Editor**, paste the contents of
   `supabase/schema.sql`, and run it. This creates all tables and seeds the
   single profile row.
3. Open **Project Settings -> API** and copy the **Project URL** and the
   **`service_role` key**.

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

> The app still runs without these configured — it falls back to default data
> and disables saving / AI / sync — so you can preview the UI immediately.

### 4. Run it

```bash
npm run dev
```

Open <http://localhost:3000>, enter your passphrase, and you land on the
Profile screen. The Nutrition AI and Activity screens are in the sidebar.

---

## Deploying to Vercel

1. Push this folder to a Git repository (GitHub / GitLab).
2. Import it at <https://vercel.com/new>.
3. Add the environment variables (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
   `ANTHROPIC_API_KEY`) in the Vercel project settings.
4. Deploy. Vercel builds and hosts both the UI and the API routes.

---

## Project structure

```
vitals-app/
  supabase/
    schema.sql             Full database schema — run once in Supabase
    migration-phase2.sql   Phase 2 column add (for existing Phase 1 databases)
  src/
    middleware.ts          Password gate (exempts /api/sync)
    lib/
      types.ts             Shared profile types
      nutrition-types.ts   Shared nutrition types + constants
      activity-types.ts    Shared activity types + constants
      calc.ts              Calculation engine (BMR / TDEE / macros)
      supabase.ts          Server-only Supabase client
      profile-store.ts     Read / write the profile row
      anthropic.ts         Claude API — web-search-backed meal extraction
      nutrition-store.ts   Read / write food logs, daily totals, item edits
      activity-store.ts    Read / write synced metrics and sleep
    components/
      AppShell.tsx         Sidebar + layout
    app/
      page.tsx             Redirects to /profile
      login/page.tsx       Passphrase screen
      profile/             Profile screen (server) + form (client)
      nutrition/           Nutrition AI screen + chat + meal record
      activity/            Activity screen (server)
      api/login            Login endpoint
      api/profile          Profile read / save endpoint
      api/nutrition        Meal-logging endpoint
      api/nutrition/item   Edit / delete a logged food item
      api/sync             Activity ingest endpoint (token-authenticated)
```

---

## Decisions recorded

- **Android companion app = pure background data bridge.** No customer-facing
  UI beyond a one-time permission/setup screen.
- **Indian food references.** The nutrition assistant prefers the **Indian Food
  Composition Tables (IFCT 2017, ICMR-NIN)** for Indian foods, with USDA
  FoodData Central as fallback, and verifies values with web search.

---

## Phase 2 — Nutrition AI

Describe a meal in plain language and the Claude-powered assistant returns a
structured breakdown — calories, protein, carbs, fat, fibre and micronutrients.
The assistant searches the web for each item's nutrition data and cross-checks
it before logging. Everything is saved to Supabase; the right-hand panel shows
today's running totals, and **Today's Meals** below the chat lets you edit or
delete any logged item.

### Upgrading an existing Phase 1 install

After replacing the project files, run the Phase 2 migration once in the
Supabase SQL Editor (`supabase/migration-phase2.sql` — it adds one column). A
fresh `schema.sql` run already includes it.

---

## Phase 3 — Activity sync (now included)

The **Activity** screen is live. It shows steps, active calories, resting heart
rate, HRV and last night's sleep, plus a 7-day calorie intake-vs-burn trend.

Activity data is written by **`POST /api/sync`**, a token-authenticated ingest
endpoint. It is exempt from the password gate and instead checks the
`SYNC_TOKEN` shared secret (sent as an `Authorization: Bearer <token>` header
or an `x-sync-token` header).

Request body:

```json
{
  "metrics": [
    { "date": "2026-05-24", "metric": "steps", "value": 8421 },
    { "date": "2026-05-24", "metric": "active_kcal", "value": 410 },
    { "date": "2026-05-24", "metric": "rhr", "value": 58 },
    { "date": "2026-05-24", "metric": "hrv", "value": 64 }
  ],
  "sleep": [
    { "night": "2026-05-24", "totalMin": 431, "deepMin": 78,
      "remMin": 96, "lightMin": 240, "awakeMin": 17, "score": 82 }
  ]
}
```

Valid `metric` values are `steps`, `active_kcal`, `total_kcal`, `rhr` and
`hrv`. Rows upsert on `(date, metric)` and on `night`, so re-sending a day's
data simply overwrites it. No database migration is needed — the `daily_metric`
and `sleep_session` tables were created back in Phase 1's `schema.sql`.

### Next: the Android companion app

The ingest endpoint and Activity screen are ready. The remaining piece is the
**Android companion app** — a background data bridge that reads Health Connect
on the phone and pushes steps, heart rate, HRV and sleep to `/api/sync`. It
will ship as a Kotlin project to build in Android Studio.


---

## Phase 4 — Biological age + the Today dashboard (now included)

The **Today** dashboard is live and is the app's home screen. It leads with
your **estimated biological age**, followed by calorie balance, macros, sleep
and activity.

### The biological-age engine

`src/lib/bioage.ts` is a transparent, pure estimator. It starts from your
chronological age and shifts it using markers that research links to the pace
of ageing, each compared to an age/sex-referenced norm:

- **VO2max** — cardiorespiratory fitness, the strongest anchor (optional;
  entered on the Profile screen)
- **Resting heart rate** — averaged from synced data
- **Heart rate variability (RMSSD)** — averaged from synced data
- **Sleep** — average nightly duration vs a ~7.5 h optimum
- **Body-fat %** — composition outside the healthy range

Every contribution is capped so one noisy reading cannot dominate, and the
total shift is capped at +/- 12 years. The Today screen shows each marker's
contribution, so the number is never a black box. A daily snapshot is saved to
`bio_age_snapshot`, and a trend line builds up over time.

### Upgrading an existing install

Run the Phase 4 migration once in the Supabase SQL Editor —
`supabase/migration-phase4.sql` adds the optional `vo2max` column to the
profile. A fresh `schema.sql` run already includes it. Then enter your VO2max
on the Profile screen if your watch reports it.


---

## Phase 5 — Accounts (multi-user)

Vityl is now multi-user. The single shared passphrase is gone; every visitor
creates their own account and sees only their own data.

- **Sign-up / sign-in** with email and password. Passwords are hashed with
  scrypt (Node's built-in crypto); sessions are httpOnly cookies backed by a
  `session` table.
- **Per-user data.** Every table carries a `user_id`; all server queries are
  scoped to the signed-in user. Row-level security is enabled so the public
  anon key cannot read anything — all access is via the server-only
  service-role key.
- **Landing page.** `/login` is a public, SEO-optimised landing page with the
  sign-in call to action and an app-download section.
- **Per-user activity sync.** The shared `SYNC_TOKEN` is replaced by a personal
  device token shown on each user's Profile screen. Paste it into the Vityl
  Android app — `/api/sync` resolves the token to the right account.

`APP_PASSWORD` and `SYNC_TOKEN` environment variables are no longer used.

### Setting up Phase 5

1. **Database.** For a fresh database, run the updated `supabase/schema.sql`.
   To upgrade an existing Phase 1-4 database in place, run
   `supabase/migration-phase5.sql` instead.
2. **Claim your old data (existing databases only).** After you create your
   account, run this once in the Supabase SQL Editor so your previously synced
   activity and meals attach to it:

   ```sql
   update daily_metric     set user_id = (select id from app_user order by created_at limit 1) where user_id is null;
   update sleep_session    set user_id = (select id from app_user order by created_at limit 1) where user_id is null;
   update food_log         set user_id = (select id from app_user order by created_at limit 1) where user_id is null;
   update food_item        set user_id = (select id from app_user order by created_at limit 1) where user_id is null;
   update bio_age_snapshot set user_id = (select id from app_user order by created_at limit 1) where user_id is null;
   ```

   Your profile biometrics are quick to re-enter on the Profile screen.
3. **Reconnect the Android app.** Open the Profile screen, copy your personal
   sync token, and paste it into the Vityl Bridge app in place of the old
   shared token.
