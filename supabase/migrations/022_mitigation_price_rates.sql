-- Draft cost-per-unit table for turning captured dimensions (see
-- property_measurements, migration 021) into a rough mitigation cost
-- estimate. `category` is the controlled vocabulary the inspector picks
-- from when logging a measurement in Guided Entry (see the category select
-- added to MeasurementInlineForm) — matching a measurement to a rate is a
-- straight category lookup, not fuzzy text matching.
--
-- rate_low/rate_high (not a single rate) since real contractor costs vary
-- by region/material/access — a range is more honest than false precision.
-- unit is constrained to 'ft'/'sq ft' to match what the Measurements
-- capture flow (and its AI dimension estimate) currently supports; adding
-- an 'each' unit for fixed-cost, non-dimensional items (vent covers,
-- window/door replacement) is a reasonable future addition but isn't wired
-- into the estimator yet.
--
-- Seeded rates below are PLACEHOLDER STARTING POINTS, not sourced pricing
-- data — edit them from the /estimate tab before relying on any total.
--
-- No RLS, same pattern as the rest of this app's operational tables —
-- employee-only surface.
create table if not exists mitigation_price_rates (
  id uuid primary key default gen_random_uuid(),
  category text not null unique,
  unit text not null check (unit in ('ft', 'sq ft')),
  rate_low numeric not null,
  rate_high numeric not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into mitigation_price_rates (category, unit, rate_low, rate_high, notes) values
  ('Noncombustible Fence Replacement (metal)', 'ft', 30, 60, 'Draft placeholder — replacing wood/vinyl fencing within 5 ft of the home with metal.'),
  ('6" Noncombustible Wall Base Clearance', 'ft', 15, 35, 'Draft placeholder — gravel/pavers/stucco strip at the base of exterior walls.'),
  ('Gutter Guard Installation', 'ft', 8, 15, 'Draft placeholder — noncombustible gutter guards, Plus-level requirement.'),
  ('Brush / Vegetation Clearance (0-5 ft zone)', 'sq ft', 1, 3, 'Draft placeholder — full removal to bare mineral soil.'),
  ('Vegetation Thinning & Pruning (5-30 ft zone)', 'sq ft', 0.50, 2, 'Draft placeholder — canopy/shrub spacing and clearance work.'),
  ('Noncombustible Groundcover Conversion', 'sq ft', 4, 9, 'Draft placeholder — gravel, pavers, or decomposed granite over mulch/turf.'),
  ('Noncombustible Deck Resurfacing', 'sq ft', 20, 45, 'Draft placeholder — solid noncombustible walking surface retrofit.'),
  ('Noncombustible Siding Replacement', 'sq ft', 10, 25, 'Draft placeholder — full wall covering replacement, Plus-level requirement.'),
  ('Class A Roof Replacement', 'sq ft', 6, 14, 'Draft placeholder — varies heavily by material (shingle vs. tile vs. metal).')
on conflict (category) do nothing;

-- Controlled category matching a mitigation_price_rates row (see above) —
-- nullable so measurements captured before this migration aren't broken,
-- but the app requires it going forward for new captures.
alter table property_measurements
  add column if not exists category text;
