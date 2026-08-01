-- Adds name + phone alongside the existing customer_email, so the CRM tab
-- can show real contact info per customer instead of just an address and an
-- email address. Both nullable — most existing properties won't have these
-- backfilled.
alter table properties add column if not exists customer_name text;
alter table properties add column if not exists customer_phone text;
