-- Second Cal.com event type: the on-site inspection booking (separate from
-- the 15-min intro call handled by 015_booking_payments.sql). Same
-- webhook endpoint, distinguished by eventTypeId — see
-- app/api/webhooks/calcom/route.js.
--
-- Unlike the intro call (always creates a new property), an inspection
-- booking usually belongs to a property that already exists from an
-- earlier intro-call booking, so it's matched by customer_email and
-- UPDATEs that row instead of inserting a duplicate. inspection_event_uid
-- is its own idempotency key, separate from booking_event_uid (the intro
-- call's uid), since a single property can go through both bookings.

alter table properties add column if not exists inspection_event_uid text;
alter table properties add column if not exists inspection_scheduled_at timestamptz;
create unique index if not exists properties_inspection_event_uid_idx on properties (inspection_event_uid) where inspection_event_uid is not null;
