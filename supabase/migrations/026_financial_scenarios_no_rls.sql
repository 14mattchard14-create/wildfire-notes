-- financial_scenarios ended up with Row Level Security enabled and no
-- policy (likely this Supabase project's "RLS enabled by default for new
-- tables" setting), which silently blocked every insert from the app with
-- "new row violates row-level security policy". Every other operational,
-- employee-only table in this app (mitigation_price_rates, crm_followups,
-- properties, etc.) has RLS off — bring this table in line with that
-- existing pattern rather than adding policies.
alter table financial_scenarios disable row level security;
