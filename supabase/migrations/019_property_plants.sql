-- Plant log for vegetation-related zones (0-5 ft, 5-30 ft defensible space,
-- Overall Site), so the report can call out each plant's name and let the
-- report-generation AI describe its native/non-native status and wildfire
-- risk, instead of only a general vegetation condition note. Stored by
-- zone (not by walkthrough segment/side) since the report itself merges
-- same-zone findings across sides — see report-draft/route.js.
--
-- No RLS, same pattern as guided_segments/entries/priorities: this is
-- operational inspection data on the employee-only app surface, not
-- customer-facing data.
create table if not exists property_plants (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  zone text not null,
  name text not null,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists property_plants_property_id_idx on property_plants(property_id);
