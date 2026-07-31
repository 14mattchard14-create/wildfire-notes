-- Site Notes used to be a standalone tab with 15 freeform fields, saved to
-- its own `site_notes` table keyed only by property_id. That's now folded
-- into Guided Entry as one freeform notes box per segment, so it lives
-- alongside the segment's photo/ai_suggestions in guided_segments (already
-- keyed by property_id + segment_key).
alter table guided_segments
  add column if not exists notes text;
