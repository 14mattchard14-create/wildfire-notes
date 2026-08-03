-- Companion to satellite_image_url (006) — stores a Google Street View
-- Static image of the property so the pre-flight scan shows the front
-- elevation (roof, siding, vents, eaves) in addition to the top-down
-- satellite crop. Same storage pattern: public URL, image itself lives in
-- the existing 'entry-photos' bucket under a street-view/ prefix.
alter table properties
  add column if not exists street_view_image_url text;
