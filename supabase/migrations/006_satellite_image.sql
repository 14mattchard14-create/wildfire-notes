-- Stores the fetched satellite image publicly so the Guided Entry UI can
-- display it (with clickable per-area dots) instead of just showing the
-- AI's text summary. The image itself lives in the existing 'entry-photos'
-- storage bucket under a satellite/ prefix — no new bucket needed.
alter table properties
  add column if not exists satellite_image_url text;
