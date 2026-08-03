-- Splits each mitigation_price_rates row's single cost-per-unit range into
-- separate Materials and Labor ranges, with Total computed automatically
-- (generated column, always material + labor — never stored out of sync).
-- Requested so the /estimate tab can show a materials/labor/total
-- breakdown, not just one lump rate.

alter table mitigation_price_rates
  add column if not exists material_rate_low numeric,
  add column if not exists material_rate_high numeric,
  add column if not exists labor_rate_low numeric,
  add column if not exists labor_rate_high numeric;

-- Backfill the 9 draft categories seeded in migration 022 with a specific
-- material/labor split per category (material-heavy for fencing/decking/
-- siding/groundcover, labor-heavy for vegetation clearance/thinning) —
-- each pair still sums to that category's original total, so nothing
-- silently changes for anyone who already ran 022. Still draft/placeholder
-- numbers, same as before — adjust from the /estimate tab.
update mitigation_price_rates set material_rate_low = 18,  material_rate_high = 35, labor_rate_low = 12,   labor_rate_high = 25 where category = 'Noncombustible Fence Replacement (metal)' and material_rate_low is null;
update mitigation_price_rates set material_rate_low = 8,   material_rate_high = 18, labor_rate_low = 7,    labor_rate_high = 17 where category = '6" Noncombustible Wall Base Clearance' and material_rate_low is null;
update mitigation_price_rates set material_rate_low = 5,   material_rate_high = 9,  labor_rate_low = 3,    labor_rate_high = 6  where category = 'Gutter Guard Installation' and material_rate_low is null;
update mitigation_price_rates set material_rate_low = 0.10, material_rate_high = 0.30, labor_rate_low = 0.90, labor_rate_high = 2.70 where category = 'Brush / Vegetation Clearance (0-5 ft zone)' and material_rate_low is null;
update mitigation_price_rates set material_rate_low = 0.05, material_rate_high = 0.20, labor_rate_low = 0.45, labor_rate_high = 1.80 where category = 'Vegetation Thinning & Pruning (5-30 ft zone)' and material_rate_low is null;
update mitigation_price_rates set material_rate_low = 2.5, material_rate_high = 6,   labor_rate_low = 1.5,  labor_rate_high = 3   where category = 'Noncombustible Groundcover Conversion' and material_rate_low is null;
update mitigation_price_rates set material_rate_low = 12,  material_rate_high = 27, labor_rate_low = 8,    labor_rate_high = 18  where category = 'Noncombustible Deck Resurfacing' and material_rate_low is null;
update mitigation_price_rates set material_rate_low = 6,   material_rate_high = 15, labor_rate_low = 4,    labor_rate_high = 10  where category = 'Noncombustible Siding Replacement' and material_rate_low is null;
update mitigation_price_rates set material_rate_low = 3.5, material_rate_high = 8,  labor_rate_low = 2.5,  labor_rate_high = 6   where category = 'Class A Roof Replacement' and material_rate_low is null;

-- Any other row (custom categories added since 022, or the 9 above if
-- somehow not matched by name) falls back to material = old total, labor =
-- 0 — preserves the existing total exactly rather than guessing a split;
-- redistribute from the /estimate tab as needed.
update mitigation_price_rates
  set material_rate_low = coalesce(material_rate_low, rate_low),
      material_rate_high = coalesce(material_rate_high, rate_high),
      labor_rate_low = coalesce(labor_rate_low, 0),
      labor_rate_high = coalesce(labor_rate_high, 0)
  where material_rate_low is null or labor_rate_low is null;

alter table mitigation_price_rates
  alter column material_rate_low set not null,
  alter column material_rate_high set not null,
  alter column labor_rate_low set not null,
  alter column labor_rate_high set not null,
  alter column material_rate_low set default 0,
  alter column material_rate_high set default 0,
  alter column labor_rate_low set default 0,
  alter column labor_rate_high set default 0;

alter table mitigation_price_rates
  add column if not exists total_rate_low numeric generated always as (material_rate_low + labor_rate_low) stored,
  add column if not exists total_rate_high numeric generated always as (material_rate_high + labor_rate_high) stored;

alter table mitigation_price_rates
  drop column if exists rate_low,
  drop column if exists rate_high;
