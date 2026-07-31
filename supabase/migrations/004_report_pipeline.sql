-- Adds a private draft stage to report generation, separate from the
-- public shared_reports table. A draft lives only in properties.* until
-- an inspector explicitly publishes it, at which point it's copied into
-- shared_reports (same table that already powers /report/[token]).

alter table properties add column if not exists report_status text
  check (report_status in ('draft', 'published'));

alter table properties add column if not exists report_draft_markdown text;

-- Links a property to its live shared_reports row once published, so we
-- know which token to update on republish instead of creating duplicates.
alter table properties add column if not exists shared_report_token text;
