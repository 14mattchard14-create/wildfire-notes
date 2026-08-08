-- Editable, version-tracked, commentable business plan for the
-- Business > Plan tab. This is intentionally DB-backed rather than
-- writing back to business/business-plan.md: Vercel's serverless
-- functions don't have a persistent/writable filesystem in production
-- (writes to fs would vanish the moment the function's container is
-- torn down), so the database has to be the source of truth for
-- anything editable from the deployed app. The markdown file stays in
-- the repo as the original captured version; the "Import from
-- business-plan.md" action in the app one-time-seeds this table from
-- it, and from then on the DB row is what's live and editable.
--
-- business_plan is a singleton (one row = the current document).
-- business_plan_versions is an append-only history: one row per save,
-- storing both the full document snapshot and just the changed
-- section's before/after text (word-diffing the whole ~2,000-word
-- document would blow past wordDiff()'s 600-word token cap in
-- lib/reportSchema.js and degrade to a naive all-removed/all-added
-- diff, so edits are scoped to one section at a time and diffed at
-- that scope, where wordDiff() actually produces a useful diff).
create table if not exists business_plan (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid
);

create table if not exists business_plan_versions (
  id uuid primary key default gen_random_uuid(),
  content text not null,
  section text,
  section_before text,
  section_after text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists business_plan_versions_created_idx
  on business_plan_versions (created_at desc);

create table if not exists business_plan_comments (
  id uuid primary key default gen_random_uuid(),
  section text not null,
  body text not null,
  resolved boolean not null default false,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists business_plan_comments_section_idx
  on business_plan_comments (section, created_at);

-- No RLS, same pattern as the rest of this app's operational tables —
-- employee-only surface, enforced at the API route layer via
-- getAuthedUser()/profile.role, not at the database layer. Explicitly
-- disabled rather than just left unmentioned: this Supabase project has
-- shown RLS getting auto-enabled on new tables with no policy (bit us
-- once already on financial_scenarios — migration 026), which silently
-- blocks every insert with "new row violates row-level security policy."
alter table business_plan disable row level security;
alter table business_plan_versions disable row level security;
alter table business_plan_comments disable row level security;
