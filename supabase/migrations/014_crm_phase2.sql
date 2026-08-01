-- CRM phase 2: message templates, unsubscribe tracking, and call/text
-- logging. Extends the crm_followups log (012) and customer contact fields
-- (013) — see NEXT_STEPS.md round 46 for the full writeup.

-- Reusable email templates for the CRM's "Send" flow, so follow-up emails
-- don't have to be typed from scratch every time. {{address}} and {{name}}
-- are substituted at send time. Seeded with a starting set covering the
-- business's actual follow-up patterns (annual check-ins, home-hardening
-- progress reports, service confirmations for basic work like mesh
-- installs, seasonal debris checks) — editable/addable from the CRM tab.
create table if not exists crm_message_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  subject text not null,
  body text not null,
  created_by_name text,
  created_at timestamptz not null default now()
);

insert into crm_message_templates (name, subject, body) values
(
  'Annual Check-In',
  'Time for your annual wildfire risk check-in — {{address}}',
  E'Hi {{name}},\n\nIt''s been about a year since your last wildfire risk assessment at {{address}}. Conditions around a property can change quickly — new growth, debris buildup, or storm damage can all affect your risk level.\n\nWould you like to schedule a quick check-in to make sure everything''s still in good shape? Just reply to this email or give us a call.'
),
(
  'Home Hardening Progress Report',
  'Ready to document your home hardening progress — {{address}}',
  E'Hi {{name}},\n\nSince your last report, it sounds like you''ve made some great improvements to harden your property against wildfire risk. We''d love to come back out and document those changes with an updated report — it''s a great way to show the before-and-after progress.\n\nLet us know a good time and we''ll get it scheduled.'
),
(
  'Service Confirmation',
  'Confirming your upcoming service — {{address}}',
  E'Hi {{name}},\n\nThis is a quick note confirming the upcoming work at {{address}}. We''ll be in touch with a specific date and time shortly. Let us know if anything needs to change.'
),
(
  'Seasonal Debris Check',
  'Seasonal debris check — {{address}}',
  E'Hi {{name}},\n\nWith the season changing, it''s a good time to check for debris buildup around {{address}} — leaves, dry brush, and fallen branches can add up fast and increase wildfire risk. Want us to swing by and take a look?'
),
(
  'General Follow-up',
  'Checking in — {{address}}',
  E'Hi {{name}},\n\nJust checking in about your property at {{address}}. Let us know if you have any questions or if there''s anything we can help with.'
)
on conflict do nothing;

-- Unsubscribe tracking. Follow-up emails (unlike the one-time "your report
-- is ready" notification) edge into marketing territory, so customers get
-- an opt-out link in every one. unsubscribe_token is the unguessable value
-- used in that link (not the property id) so it can't be enumerated.
alter table properties add column if not exists unsubscribed boolean not null default false;
alter table properties add column if not exists unsubscribed_at timestamptz;
alter table properties add column if not exists unsubscribe_token uuid not null default gen_random_uuid();
create unique index if not exists properties_unsubscribe_token_idx on properties (unsubscribe_token);

-- channel distinguishes an actual sent email from a manually logged phone
-- call or text (which never goes through Resend — it's just a record).
-- template_id records which template (if any) was used, for later
-- reference; nullable since manual sends/logs don't use one.
alter table crm_followups add column if not exists channel text not null default 'email' check (channel in ('email', 'call', 'text', 'note'));
alter table crm_followups add column if not exists template_id uuid references crm_message_templates(id) on delete set null;
