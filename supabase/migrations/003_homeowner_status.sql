-- Tracks where each property's homeowner walkthrough is in its lifecycle,
-- for the admin property-manager page.
--
-- Lifecycle: null (no invite yet) -> 'invited' -> 'in_progress'
--            -> 'submitted' (homeowner clicked Finish, inspector notified)
--            -> 'done' (inspector marked it reviewed/report generated)

alter table properties add column if not exists homeowner_status text
  check (homeowner_status in ('invited', 'in_progress', 'submitted', 'done'));

alter table properties add column if not exists homeowner_submitted_at timestamptz;
