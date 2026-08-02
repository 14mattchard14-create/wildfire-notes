-- Supports the public website calling straight into this app when a
-- customer requests a Guided Photo Assessment (no scheduling needed for
-- that path — see app/api/public/guided-request/route.js). Captures the
-- package tier / method context the website form collects that has
-- nowhere else to live on properties, so it isn't silently dropped.

alter table properties add column if not exists lead_notes text;
