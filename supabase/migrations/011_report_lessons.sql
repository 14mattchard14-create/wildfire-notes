-- "Lessons learned" notes — the human-written half of the feedback loop
-- documented on the new /insights section. Where report_versions captures
-- WHAT changed between an AI draft and the final report (mechanically, via
-- diffSectionSlices), this table captures WHY — a reviewer's short note on
-- a pattern worth fixing in future AI-generated drafts. `applied` tracks
-- whether that note has already been folded into the report-draft prompt,
-- so /insights/lessons can distinguish "still open" from "already acted on"
-- without deleting the history.
create table if not exists report_lessons (
  id uuid primary key default gen_random_uuid(),
  -- Optional — a lesson can be tied to the property that prompted it, or
  -- left null for a general observation not specific to any one report.
  property_id uuid references properties(id) on delete set null,
  note text not null,
  created_by uuid,
  created_by_name text,
  applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists report_lessons_created_idx
  on report_lessons (created_at desc);
create index if not exists report_lessons_property_idx
  on report_lessons (property_id);
