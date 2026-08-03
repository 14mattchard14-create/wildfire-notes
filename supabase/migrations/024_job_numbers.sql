-- Unique, auto-generated job number per property (e.g. JOB-00001) —
-- assigned automatically on insert via trigger, so every creation path
-- (New Property in /manage, the public guided-request intake, homeowner
-- signup, etc.) gets one without any app-code changes. Read-only in the UI
-- by design: it's a stable reference number, not something an inspector
-- should be able to collide or reassign.
create sequence if not exists job_number_seq;

alter table properties add column if not exists job_number text unique;

create or replace function set_job_number() returns trigger as $$
begin
  if new.job_number is null then
    new.job_number := 'JOB-' || lpad(nextval('job_number_seq')::text, 5, '0');
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_set_job_number on properties;
create trigger trg_set_job_number
  before insert on properties
  for each row execute function set_job_number();

-- Backfill existing rows in creation order, so earlier jobs get lower
-- numbers (a single UPDATE with a window function can't call nextval()
-- per-row safely, hence the loop).
do $$
declare r record;
begin
  for r in select id from properties where job_number is null order by created_at asc loop
    update properties set job_number = 'JOB-' || lpad(nextval('job_number_seq')::text, 5, '0') where id = r.id;
  end loop;
end $$;
