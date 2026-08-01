-- Follow-up tracking for the CRM tab. One row per scheduled (or completed)
-- follow-up touchpoint on a property's customer — deliberately a log table
-- rather than a single "next follow-up" column on properties, so history
-- survives (e.g. "we already followed up in March, schedule the next one
-- for September"). Sending is manual for now (see /api/crm/send-followup);
-- rule-based auto-triggering is a later phase once the security review is
-- done, since that would run unattended with the service-role key on a
-- schedule.
create table if not exists crm_followups (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  due_date date,
  note text,
  status text not null default 'pending' check (status in ('pending', 'done', 'skipped')),
  sent_at timestamptz,
  completed_at timestamptz,
  created_by uuid,
  created_by_name text,
  created_at timestamptz not null default now()
);

create index if not exists crm_followups_property_idx on crm_followups (property_id);
create index if not exists crm_followups_due_idx on crm_followups (due_date);
create index if not exists crm_followups_status_idx on crm_followups (status);
