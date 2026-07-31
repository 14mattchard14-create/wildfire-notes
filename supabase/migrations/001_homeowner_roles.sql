-- Homeowner role support: profiles table + homeowner_invites table.
-- Run this whole file once in the Supabase SQL editor (Dashboard > SQL Editor > New query).
--
-- Why `profiles` and not `user_metadata`: user_metadata is editable by the
-- signed-in user themselves via supabase.auth.updateUser(), so a homeowner
-- could grant themselves 'employee' role client-side if role lived there.
-- `profiles` is a normal table gated by RLS, writable only by the service
-- role (our API routes) — the client can read its own row but never write
-- role or property_id directly.

-- Ensure gen_random_uuid() is available (Supabase enables this by default,
-- but this is a no-op safety net if it isn't).
create extension if not exists pgcrypto;

-- 1. profiles ---------------------------------------------------------------

create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'employee' check (role in ('employee', 'homeowner')),
  property_id uuid references properties(id) on delete set null,
  created_at  timestamptz not null default now()
);

alter table profiles enable row level security;

-- Every signed-in user can read their own profile row (needed so the app
-- can branch the UI on role/property_id). No client can read anyone else's
-- row, and no client can INSERT/UPDATE at all — only the service role
-- (used server-side in our API routes) can write to this table.
drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);

-- Auto-create a profile row for every new signup, defaulting to 'employee'
-- so existing inspector accounts keep working exactly as before. Homeowner
-- accounts get their role/property_id overwritten server-side immediately
-- after this trigger fires, during invite redemption (see
-- /api/homeowner-signup).
create or replace function handle_new_user_profile()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, 'employee')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
  after insert on auth.users
  for each row execute function handle_new_user_profile();

-- Backfill: give every existing user (all current inspectors) an
-- 'employee' profile row so nothing breaks for accounts created before
-- this migration ran.
insert into profiles (id, role)
select id, 'employee' from auth.users
on conflict (id) do nothing;

-- 2. homeowner_invites --------------------------------------------------------

create table if not exists homeowner_invites (
  id          uuid primary key default gen_random_uuid(),
  token       text not null unique,
  property_id uuid not null references properties(id) on delete cascade,
  created_by  uuid references auth.users(id),
  used        boolean not null default false,
  used_by     uuid references auth.users(id),
  expires_at  timestamptz not null default (now() + interval '14 days'),
  created_at  timestamptz not null default now()
);

alter table homeowner_invites enable row level security;

-- No client-side access at all — invite creation and redemption both go
-- through server-side API routes using the service role key. This table
-- intentionally has zero RLS policies, which means PostgREST denies all
-- direct client access by default.
