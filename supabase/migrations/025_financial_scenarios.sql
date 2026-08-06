-- Named, saveable "what-if" scenarios for the /business/forecast calculator.
-- This replaces the growth-poam.xlsx spreadsheet as the working tool (the
-- xlsx stays in the wildfire-notes/business/ folder as a record of the
-- original modeling, but this table is the live, editable version going
-- forward — no LibreOffice recalculation step, everything computes in the
-- browser).
--
-- `assumptions` and `monthly` are jsonb rather than fixed columns on
-- purpose: the whole point of this tool is to freely add/adjust inputs
-- (prices, hours per job, margins, overhead line items, marketing spend,
-- capacity thresholds) without a migration every time the shape changes.
-- The app is the source of truth for what keys it expects; see
-- app/business/forecast/page.js for the current shape.
--
-- No RLS, same pattern as the rest of this app's operational tables —
-- employee-only surface.
create table if not exists financial_scenarios (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  notes text,
  assumptions jsonb not null default '{}'::jsonb,
  monthly jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists financial_scenarios_updated_at_idx
  on financial_scenarios (updated_at desc);
