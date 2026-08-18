-- Portal split + roles, phase 1: expand the role enum, add per-property
-- inspector assignment, and a place to store admin-only planning docs
-- inside the app. See PORTALS_AND_ROLES_PLAN.md for the full design —
-- this migration only builds what that doc marks "building now": the
-- schema underneath the Users & Roles tab and the Documentation tab.
-- The CG Inspector portal itself, per-route permission enforcement, and
-- the Partner approval-workflow tables are explicitly NOT part of this
-- migration — they follow later, once this schema exists to build on.

-- 1. Expand profiles.role ----------------------------------------------------
--
-- Was: check (role in ('employee', 'homeowner')). 'employee' is kept
-- (not dropped) so existing accounts don't fail the constraint the
-- instant this runs — they get explicitly reassigned to a real role via
-- the new Users & Roles tab, not auto-migrated by this script (per
-- PORTALS_AND_ROLES_PLAN.md resolved question #8).
alter table profiles drop constraint if exists profiles_role_check;
alter table profiles add constraint profiles_role_check
  check (role in ('employee', 'homeowner', 'admin', 'partner', 'field_inspector', 'manager'));

-- 2. Per-property inspector assignment ---------------------------------------
--
-- Not tied to a fixed "Field Inspector" role — Admin, Partner, or a
-- dedicated hire can all be the assigned inspector on a given property.
-- The CG Inspector portal (built later) filters to "my assigned
-- properties" using this column, regardless of the logged-in user's
-- overall role.
alter table properties add column if not exists assigned_inspector_id uuid references auth.users(id) on delete set null;

create index if not exists properties_assigned_inspector_idx
  on properties (assigned_inspector_id);

-- 3. Admin-only documents ----------------------------------------------------
--
-- Storage for planning docs (PORTALS_AND_ROLES_PLAN.md and friends) inside
-- the app itself, not just as repo files — admin-only visibility, enforced
-- at the API route layer via getAuthedUser()/profile.role, same pattern as
-- every other operational table in this app (see business_plan, migration
-- 027, for the precedent).
create table if not exists admin_documents (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null default '',
  created_by_name text,
  updated_by_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_documents_updated_idx
  on admin_documents (updated_at desc);

-- No RLS — explicitly disabled rather than left unmentioned. This
-- Supabase project has shown RLS getting auto-enabled on new tables with
-- no policy, which silently blocks every insert ("new row violates
-- row-level security policy") — bit us on financial_scenarios (migration
-- 026). Admin-only access is enforced in the API route, not the DB.
alter table admin_documents disable row level security;
