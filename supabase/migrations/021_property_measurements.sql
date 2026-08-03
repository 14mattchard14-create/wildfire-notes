-- Dimension capture for mitigation cost estimates: a photo of the thing
-- being measured (fence run, brush clearance width, tank-to-structure
-- distance, etc.) with a standard sheet of paper laid flat in the same
-- shot as a scale reference. report-draft sends the photo to Claude
-- vision, which locates the paper (known real-world size per
-- reference_type) and the measured item, and computes an estimated
-- dimension from the two — see app/api/report-draft/route.js.
--
-- Unlike property_plants (one shared zone across front/left/right/back),
-- each segment gets its own zone value (the segment's display label),
-- since measurements taken on different sides aren't the same finding.
--
-- reference_type is stored per-row (not hardcoded) so additional reference
-- objects (tape measure, a printed card, etc.) can be supported later
-- without a schema change — 'letter_paper' (8.5x11in) is the only type
-- captured by the app today.
--
-- No RLS, same pattern as property_plants/entries/guided_segments: this is
-- operational inspection data on the employee-only app surface, not
-- customer-facing data.
create table if not exists property_measurements (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  zone text not null,
  label text not null,
  unit text not null default 'ft',
  photo_url text not null,
  reference_type text not null default 'letter_paper',
  estimated_value numeric,
  confidence text,
  ai_notes text,
  created_at timestamptz not null default now()
);

create index if not exists property_measurements_property_id_idx on property_measurements(property_id);
