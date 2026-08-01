-- Tracks the history of a property's report over time, so edits aren't
-- just overwritten in place. Every AI-generated draft, every per-section
-- save in the review editor, and every "Final Report" checkpoint gets its
-- own row with a full snapshot of the structured report data at that
-- moment. This is what powers (a) the per-section "history" popup in the
-- review editor, showing old vs. new for that section over time, and (b)
-- the Report Quality portal's A/B export — pairing each property's very
-- first ai_draft snapshot against its most recent final snapshot as
-- before/after training examples.
create table if not exists report_versions (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  report_data jsonb not null,
  -- 'ai_draft': the untouched output of /api/report-draft, saved once per
  --   generation — this is always the "A" side of an A/B pair.
  -- 'edit': saved whenever a section is edited and confirmed in the review
  --   editor (see app/manage/[id]/review).
  -- 'final': an explicit checkpoint via the "Final Report" button, marking
  --   the current state as the designated "B" side of an A/B pair.
  source text not null check (source in ('ai_draft', 'edit', 'final')),
  -- Which section this version came from, e.g. 'exec', 'overview',
  -- 'zone:Roof', 'action' — null for whole-report snapshots (ai_draft,
  -- final).
  section text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create index if not exists report_versions_property_created_idx
  on report_versions (property_id, created_at desc);
