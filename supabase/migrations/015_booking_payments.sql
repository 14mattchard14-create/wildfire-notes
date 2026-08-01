-- Booking → CRM → payments, phase 1. See BOOKING_PAYMENTS_PLAN.md for the
-- full design and the Cal.com setup checklist this depends on.

-- Lets a property originate from an automatic Cal.com booking instead of
-- manual entry, and tracks where the lead is in the pre-inspection stage.
alter table properties add column if not exists lead_source text;
alter table properties add column if not exists booking_status text;
alter table properties add column if not exists booking_event_uid text;
alter table properties add column if not exists intro_call_at timestamptz;
create unique index if not exists properties_booking_event_uid_idx on properties (booking_event_uid) where booking_event_uid is not null;

-- Payment tracking "bones" — a manual ledger for now (see plan doc for why
-- Stripe isn't wired up yet). stripe_payment_intent_id is ready for when it
-- is, so this table doesn't need to be rebuilt, just extended.
create table if not exists crm_payments (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  amount_cents integer not null,
  currency text not null default 'usd',
  status text not null default 'pending' check (status in ('pending', 'paid', 'refunded', 'failed')),
  method text check (method in ('stripe', 'cash', 'check', 'venmo', 'other')),
  stripe_payment_intent_id text,
  discount_code text,
  discount_amount_cents integer not null default 0,
  notes text,
  paid_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);
create index if not exists crm_payments_property_idx on crm_payments (property_id);
create index if not exists crm_payments_status_idx on crm_payments (status);

-- Self-managed discount codes — independent of any payment processor, so
-- this works today and stays useful even after Stripe is added later.
create table if not exists crm_discounts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text,
  kind text not null default 'flat' check (kind in ('flat', 'percent')),
  amount numeric not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_by_name text,
  created_at timestamptz not null default now()
);
