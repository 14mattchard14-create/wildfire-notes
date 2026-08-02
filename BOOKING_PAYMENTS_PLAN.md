# Booking → CRM → Calendar → Payment: planning doc

_Status: decisions locked, building now. This is the source of truth for this initiative,
separate from NEXT_STEPS.md (the build changelog)._

## The lifecycle we're designing for

1. A prospect books a 15-min intro call on the website (or just calls in directly).
2. That booking lands in the CRM automatically — contact info and property address, no manual
   re-entry.
3. The call happens. If it's a go, an inspection gets scheduled.
4. Inspection happens, report gets published (existing flow, already built).
5. Payment gets collected and/or tracked, discounts applied where relevant.
6. Existing CRM follow-up tooling (already built) carries the relationship forward.

## Decisions

**1. Scheduling tool: Cal.com**, not Calendly. Calendly's free plan doesn't include webhooks
(that's a paid-only feature, Standard plan and up — confirmed via search, not assumption)
which would make automatic CRM population impossible without paying. Cal.com's free plan
includes webhooks, required custom booking questions, and Google Calendar sync — everything
this needs, at $0.

**2. Google Calendar: quick-add links, not OAuth sync.** Any CRM entry with a future date
(follow-ups, the intro call once booked) gets an "Add to Google Calendar" button. This uses
Google's plain URL-based quick-add — no OAuth, no token storage, no backend integration,
works regardless of booking tool. The intro call itself also lands on the calendar
automatically via Cal.com's own native Google Calendar connection (separate from this button,
zero code either way). Full two-way sync (e.g. for the on-site inspection appointment) stays
out of scope — bigger, separate work if ever needed.

**3. Payments: build the tracking "bones" now, hold off on actually processing money.**
A `crm_payments` ledger — amount, status, method, discount — filled in manually for now.
Real payment collection (Stripe Checkout) is blocked on the LLC being formed first, which is
outside this app's scope. The data model has a `stripe_payment_intent_id` column ready for
when that's wired up, so this doesn't need to be rebuilt later, just extended.

**4. Discounts: self-managed, not tied to a processor.** A `crm_discounts` table of reusable
codes (flat-dollar or percent), created/edited from the CRM. This works today independent of
Stripe, and isn't wasted work if Stripe gets added later — Stripe Coupons would be additive,
not a replacement.

## What you need to set up in Cal.com (before the webhook can go live)

1. Create a free Cal.com account, create one event type for the 15-min intro call.
2. Add two **required** custom booking questions:
   - Identifier `address` — short text, "What's the property address?"
   - Enable the built-in phone number field (shows up as `attendeePhoneNumber` in the
     webhook payload) — the name/email fields are already built in.
3. Connect your Google Calendar under Cal.com's calendar settings — this is what makes
   booked calls show up automatically, no code involved.
4. Under Webhooks, add a new webhook: URL = `https://<your-domain>/api/webhooks/calcom`,
   subscribe to `BOOKING_CREATED`, and copy the signing secret it generates.
5. Give me that secret — it goes in the `CAL_COM_WEBHOOK_SECRET` environment variable (same
   pattern as `RESEND_API_KEY` etc.), never committed to the repo.

The webhook endpoint verifies Cal.com's signature on every request (required — it's a public
URL with no login, so without verification anyone who found it could forge fake bookings into
the CRM). It reads the `address` and phone responses plus the attendee's name/email and the
booking's `uid` (used to make the webhook idempotent — safe if Cal.com retries or sends the
same event twice) and `startTime`, then creates or updates a `properties` row tagged
`lead_source: 'cal.com'`, `booking_status: 'call_scheduled'`.

Phone-only leads (no online booking) keep working exactly like today — added manually via
"New Property" on `/manage`, logged via the CRM's existing Log Contact feature. The automatic
path just feeds the same pipeline the manual path already uses.

## Data model

```
properties (existing table, new columns):
  lead_source          text   -- 'cal.com' | 'phone' | 'referral' | 'manual' | ...
  booking_status        text   -- 'call_scheduled' | 'called' | 'inspection_scheduled' | ...
  booking_event_uid      text   -- Cal.com's booking uid, unique — makes the webhook idempotent
  intro_call_at          timestamptz

crm_payments (new table):
  id                     uuid
  property_id            uuid  -> properties.id
  amount_cents            integer
  currency                text default 'usd'
  status                  text  -- 'pending' | 'paid' | 'refunded' | 'failed'
  method                  text  -- 'stripe' | 'cash' | 'check' | 'venmo' | 'other'
  stripe_payment_intent_id text  -- null until Stripe exists
  discount_code            text  -- references crm_discounts.code, null if none
  discount_amount_cents     integer default 0
  notes                    text
  paid_at                  timestamptz
  created_at               timestamptz default now()

crm_discounts (new table):
  id                     uuid
  code                    text unique
  label                   text
  kind                    text  -- 'flat' | 'percent'
  amount                  numeric  -- dollars if flat, 0-100 if percent
  active                  boolean default true
  expires_at               timestamptz
  created_at               timestamptz default now()
```

Both new webhook routes this phase touches (`/api/webhooks/calcom` now, `/api/webhooks/stripe`
later once Stripe exists) are public by necessity — no user session, external services calling
in. Signature verification on both is not optional. Worth a focused security pass on these
specifically before real bookings/money flow through them, even if the broader review you
mentioned wanting waits until later.

## Phasing (current)

1. ✅ Planning/decisions (this doc).
2. **Building now:** migration, Add-to-Google-Calendar links, discounts management, payments
   ledger UI, Cal.com webhook endpoint (code-complete, but live only once you've done the Cal.com
   setup above and given me the signing secret).
3. **Later:** Stripe Checkout/Payment Links integration once the LLC + Stripe account exist —
   extends the existing `crm_payments` table rather than replacing it.
4. **Later, only if needed:** on-site inspection → Google Calendar via real OAuth sync.

## Addendum: two people, staying on the free plan

Considered upgrading to Cal.com's paid Teams plan (or switching to Calendly's, which is
pricier per-seat) to get automatic round-robin assignment between Matt and Johnny — i.e. a
booking page that shows a slot as open if *either* is free, and auto-assigns it to whichever
one. Decided against it: that's the one thing genuinely gated behind a paid tier on both
platforms, and at two people it's not worth $150–450+/year.

**What we're doing instead, staying free:** each of Matt's and Johnny's personal availability
lives on the "Matt" / "Johnny" Google Calendars created under the single free Cal.com account.
Cal.com's own multi-calendar conflict-check computes an AND (blocks a slot only if *both* are
busy), not the OR we actually want, so instead of relying on live calendar sync we widened the
event types' availability windows to the general hours when at least one of them is typically
free. This means the booking page won't always be perfectly accurate to a specific day's
conflicts — occasionally a customer could grab a slot neither of them can actually make, and
it'd need a manual reschedule. When a booking comes in, Matt and Johnny sort out between
themselves who takes it (matches how homeowner/property assignment already works — nothing in
the CRM auto-assigns a specific inspector today, either).

## Addendum: second event type — on-site inspection booking

Added a second free-plan Cal.com event type for the on-site inspection itself, not just the
15-min intro call. Customers who choose the "On-Site Inspection" method on `/get-started` see
a booking widget right on the confirmation screen (no waiting for a callback to schedule it).

- `CAL_COM_INSPECTION_EVENT_TYPE_ID` (Cal.com's numeric event type ID) tells the webhook which
  event type a booking belongs to — without it set, everything's treated as the intro call
  (today's behavior), so this stays backward-compatible until the second event type exists.
- The webhook matches an inspection booking to the existing `properties` row from the
  customer's earlier intro call by email, and **updates** it (`booking_status:
  'inspection_scheduled'`, `visit_date`, `inspection_scheduled_at`) rather than creating a
  duplicate. If no match is found (booked directly, skipping the call), it creates a new
  property instead, same as the intro-call path.
- New columns: `inspection_event_uid` (idempotency key for this booking, separate from the
  intro call's `booking_event_uid`), `inspection_scheduled_at`.

**Setup still needed in Cal.com** (same pattern as the 15-min event): create the event type,
add the same required "address" custom question + phone field, connect it to the same
Google Calendar conflict-check, add `CAL_COM_INSPECTION_EVENT_TYPE_ID` and
`NEXT_PUBLIC_CAL_COM_INSPECTION_LINK` as env vars on both Vercel projects. The webhook and
site code are ready; this is the one manual step left.

## Addendum: report-completion alerts

Two layers, both using the existing Resend setup (`NOTIFY_EMAIL`, now comma-separated to
reach both Matt and Johnny from one env var):

1. **Immediate** — already existed (`app/api/homeowner/finish/route.js`): fires the moment a
   homeowner finishes their walkthrough and the report needs writing up.
2. **Daily digest** (new) — `app/api/cron/report-reminders`, run once a day by Vercel Cron
   (`vercel.json`). Emails a list of every property that's been sitting "submitted" for 2+
   days (`REPORT_REMINDER_DAYS` to change that) without a published report. No per-property
   "already reminded" tracking — it just recomputes the stale list each day, so a property
   drops off the moment its report is published.
