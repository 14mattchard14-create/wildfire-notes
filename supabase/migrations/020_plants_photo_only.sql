-- Simplifies property_plants (migration 019) to a pure photo capture: the
-- inspector no longer types a plant name/note in the field — they just take
-- a photo, and the report-generation AI identifies the plant and assesses
-- it visually (see app/api/report-draft/route.js). name/notes are kept
-- (now optional) rather than dropped, in case anything was saved under the
-- old text-entry version of this feature before this migration ran.
alter table property_plants
  add column if not exists photo_url text,
  alter column name drop not null;
