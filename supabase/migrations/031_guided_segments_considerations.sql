-- Structured, answerable AI considerations per segment, replacing the old
-- free-text ai_suggestions blob for the homeowner guided walkthrough (see
-- components/HomeownerGuidedEntry.js). Each element:
--   { id, text, isQuestion, answer, answeredAt, followUpPhotoUrl, followUpResponse }
-- ai_suggestions is left in place (still used by the inspector's
-- GuidedEntry.js) — this is additive, not a replacement of that column.
alter table guided_segments
  add column if not exists considerations jsonb not null default '[]'::jsonb;
