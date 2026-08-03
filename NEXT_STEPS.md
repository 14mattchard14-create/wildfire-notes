# Status — wildfire-notes

_Last updated: 2026-08-02_

## ⚠️ Action required — new migration

- Run `supabase/migrations/022_mitigation_price_rates.sql` — creates `mitigation_price_rates`
  (seeded with draft placeholder rates) and adds `property_measurements.category`. Required for
  the new /estimate tab (see round 58 below) to work at all.
- Run `supabase/migrations/021_property_measurements.sql` — creates `property_measurements`.
  Required for the new Measurements capture (see round 57 below) to save anything.
- Run `supabase/migrations/019_property_plants.sql` then `020_plants_photo_only.sql` — creates
  `property_plants` and adds its `photo_url` column. Required for the Plants field (see round 56
  below) to save anything. Run both, in order, even if you haven't run 019 yet.
- Run `supabase/migrations/018_street_view_image.sql` — adds `properties.street_view_image_url`.
  Required for the new Street View companion image (see round 55 below) to save/display at all.
- Run `supabase/migrations/015_booking_payments.sql` — adds booking fields to `properties`
  (`lead_source`, `booking_status`, `booking_event_uid`, `intro_call_at`) and two new tables,
  `crm_payments` and `crm_discounts`. Required for the CRM's Payments section, Discount Codes
  panel, and the Cal.com webhook to work at all.

## ⚠️ Action required — Cal.com setup (for the booking webhook)

The webhook endpoint (`/api/webhooks/calcom`) is code-complete but inert until you:

1. Create a free Cal.com account, create one event type for the 15-min intro call.
2. Add a **required** custom booking question with identifier `address` (short text).
3. Enable the built-in phone number field on the booking form.
4. Connect your Google Calendar in Cal.com's calendar settings (this alone makes booked calls
   show up on the calendar automatically — no code involved).
5. Add a webhook: URL `https://<your-domain>/api/webhooks/calcom`, subscribed to
   `BOOKING_CREATED`, and copy the signing secret it generates.
6. Set that secret as the `CAL_COM_WEBHOOK_SECRET` environment variable (in Vercel's project
   settings, same pattern as `RESEND_API_KEY`) — never commit it to the repo.

Full detail in `BOOKING_PAYMENTS_PLAN.md`.

- Run `supabase/migrations/014_crm_phase2.sql` — adds `crm_message_templates` (seeded with 5
  starter templates), `properties.unsubscribed`/`unsubscribed_at`/`unsubscribe_token`, and
  `crm_followups.channel`/`template_id`. Required for the CRM's template picker, unsubscribe
  link/toggle, and call/text logging to work at all.
- Run `supabase/migrations/013_customer_contact.sql` — adds `properties.customer_name` and
  `properties.customer_phone`. Required for the `/crm` table's Name field and phone column to
  save anything (email already existed).
- Run `supabase/migrations/012_crm_followups.sql` — new `crm_followups` table. Required for
  the new `/crm` tab (scheduling/tracking customer follow-ups, manual "Send Now" emails) to
  save or send anything.
- Run `supabase/migrations/011_report_lessons.sql` — new `report_lessons` table. Required for
  the new `/insights/lessons` page (freeform lessons-learned notes) to save anything.
- Run `supabase/migrations/010_report_versions.sql` — new `report_versions` table. Required
  for the review page's per-section edit tracking, the "Final Report" button, and the new
  `/quality` Report Quality portal to work at all (all three read/write this table).
- Run `supabase/migrations/009_guided_segment_notes.sql` — adds `guided_segments.notes`.
  Required for the new per-segment Notes box in Guided Entry (replaces the old Site Notes
  tab) to save anything.
- Run `supabase/migrations/008_customer_email.sql` (if not already — unconfirmed) — adds
  `properties.customer_email`, fixes the bug where sending a report to the customer
  required a homeowner invite to exist first.
- Run `supabase/migrations/007_customer_notify.sql` — adds
  `properties.customer_notified_at`, tracked by the new auto-email-on-publish feature.
- Run `supabase/migrations/006_satellite_image.sql` in the Supabase SQL editor — adds
  `properties.satellite_image_url` (stores the actual satellite photo so the UI can
  display it, not just the AI's text summary).
- `supabase/migrations/005_guided_segments.sql` — already run, confirmed working (this is
  what unblocked "Analyze Satellite View" after the Google Cloud billing/API-enable
  troubleshooting).
- No new npm packages — reuses the existing `entry-photos` Supabase Storage bucket under
  a `satellite/` prefix, no new bucket needed.

## Done this session (2026-08-02, round 58 — /estimate tab: draft cost rates + computed property estimates)

- `mitigation_price_rates` table (migration 022, see ⚠️ above): `category` (unique), `unit`
  (ft / sq ft), `rate_low`, `rate_high`, `notes` — seeded with 9 draft categories/rates covering
  the measurable WPH mitigations (fencing, wall clearance, gutter guards, vegetation clearance/
  thinning, groundcover conversion, decking, siding, roofing). These are placeholder starting
  points, not sourced pricing — edit them on the new tab before trusting any total. Fixed-cost,
  non-dimensional items (vent covers, window/door replacement) aren't covered — the rate table
  is unit-priced (ft/sq ft) only, matching what the Measurements capture flow supports.
- Guided Entry's Measurements form now has a category picker (sourced live from
  `mitigation_price_rates`) instead of a free unit toggle — picking a category locks in the unit,
  since the category is what gets matched to a rate later. `property_measurements.category` is
  nullable for backward compatibility with anything captured before this round.
- `/api/report-draft` now also selects and backfills `category` into
  `reportData.mitigationMeasurements`, same positional-match pattern as zone/label/unit. The
  review page's Mitigation Measurements edit mode got a category dropdown too, so a measurement
  that came back uncategorized (or miscategorized) can be fixed without regenerating the report.
- New `/estimate` tab (own sidebar entry): the rate table above, fully editable in place, plus a
  "Property Estimates" list — every property with at least one captured measurement, showing a
  computed total cost range and an expandable line-item breakdown (dimension × rate, per
  measurement). Unmatched/uncategorized/not-yet-estimated measurements are flagged rather than
  silently dropped from the total. All client-side Supabase reads/writes, no new API routes —
  same pattern as the rest of this app's operational CRUD.

## Done this session (2026-08-02, round 57 — Mitigation Measurements: dimension capture for cost estimates)

You want to eventually provide cost estimates for all potential mitigations, which means capturing
dimensions (fence runs, brush clearance area, tank-to-structure distance, etc.). This round adds
the capture + AI dimension estimate; actual $ cost estimates are a separate follow-up that'll need
unit-pricing data as input, not built yet.

- `property_measurements` table (migration 021, see ⚠️ above): `property_id`, `zone`, `label`,
  `unit`, `photo_url`, `reference_type` (only `'letter_paper'` supported today, stored per-row so
  other reference objects can be added later without a schema change), plus `estimated_value`,
  `confidence`, `ai_notes` columns (unused by the app today — the computed estimate currently lives
  in the report draft only, not written back to this table).
- Guided Entry: a "Measurements" section, styled/interacted with exactly like Plants (collapsed row
  → expand → list of what's logged, click one to edit/delete, "+ Add another") — but available on
  *every* segment, not just vegetation zones, since a mitigation needing a size estimate can turn up
  anywhere. Each entry is a photo (with instructions to lay a standard sheet of paper flat in the
  same shot as scale reference), a short label ("brush clearance run"), and a unit (ft / sq ft).
- `/api/report-draft` sends each measurement photo to Claude vision alongside the label/unit/scale
  description, and asks it to locate the paper (known 8.5×11in size), locate the measured item, and
  produce a best-effort `estimatedValue` + `confidence` (High/Medium/Low/Unable to estimate) +
  `notes` explaining its reasoning — explicitly told to return null rather than guess blind if the
  reference object isn't usable. This is a visual estimate for scoping, not a survey-grade
  measurement — the report says so.
- New "Mitigation Measurements" section renders in both the customer report (`/report/[token]`,
  with its own TOC entry and search indexing) and the review page (read mode via the shared
  component, edit mode for correcting the AI's label/value/unit/confidence/notes or dropping a bad
  photo read).

## Done this session (2026-08-02, round 56 — Plants field: photo capture + Vegetation Considerations report section)

Went through two shapes this round — first a text name/notes field folded into each zone's
finding, then reworked per your follow-up into a pure photo capture with its own report section.
This describes the final version:

- `property_plants` table (migrations 019 + 020, see ⚠️ above — both need to be run):
  `property_id`, `zone`, `photo_url`.
- Guided Entry: "Plants" now shows up styled and interacted with exactly like a checklist item
  (collapsed row → expand → list of what's logged, click one to replace/delete it, "+ Add
  another") on the segments tied to a vegetation zone — Front/Left/Right/Back (sharing one list
  for `0-5 FT. Noncombustible Zone`, since it's the same zone finding regardless of which side you
  spotted it from), the `5-30 FT Defensible Space — Vegetation` step, and Overall Site. Unlike a
  real checklist item there's no status/note — just a photo, since plants aren't a WPH compliance
  category.
- Checklist items themselves (not just Plants) got the same list/edit treatment while I was in
  there per your request — clicking an item now shows everything already logged for it, each
  entry editable (or deletable) in place via a pre-filled form, instead of only ever adding a new
  blind entry next to it.
- `/api/report-draft` sends every plant photo straight to the AI as an image (via the Anthropic
  API's URL image source — no fetch/base64 step needed) alongside the usual text prompt, each one
  labeled with the zone it came from. The response now includes a new top-level
  `vegetationConsiderations` array (one entry per photo, in order) with an AI-identified
  `plantId`, an `assessment` of whether it's a fire-safe/native-appropriate choice, and
  `spacingGuidance`, plus a one-time `vegetationIntro` prefacing that plant *combination and
  spacing* — not any single species — is what most drives defensible-space risk. This is a
  separate report section now, not folded into any zone's finding text.
- New "Vegetation Considerations" section renders in both the customer report (`/report/[token]`,
  with its own TOC entry and search indexing) and the review page (read mode via the same shared
  component, plus an edit mode for correcting the AI's plant ID/assessment/spacing text or
  dropping a bad photo read).

## Done this session (2026-08-02, round 55 — Street View companion image on the pre-flight scan)

- Added `properties.street_view_image_url` (migration 018, see ⚠️ above — needs to be run).
- `/api/satellite-analysis` now also fetches a Google Street View Static image of the property
  (checked via the free metadata endpoint first, so addresses with no Street View coverage just
  skip it — not a failure). Stored in the same `entry-photos` bucket under a `street-view/`
  prefix.
- When available, the Street View image is sent to the AI alongside the satellite crop — it can
  see roof material, siding, vents, and eaves that a top-down view can't show, so the per-segment
  pre-flight notes should be a bit sharper.
- Guided Entry's "Analyze Satellite View" step now shows both images side by side (Satellite /
  Street View), with a small note if no Street View coverage was found for that address.
- Also fixed two report bugs from testing: the address heading on the customer report was
  rendering near-invisible (dark text on the dark navy header — a global CSS rule was overriding
  the inherited white), and the PDF export could cut a photo caption in half across a page break
  (photo tiles had no page-break protection, unlike finding cards).

## Done this session (2026-08-02, round 54 — Resend domain verified, real sends unblocked)

Root cause of the 403 "testing emails only" error: zero verified domains on the Resend account,
so every send was restricted to the sandbox address. Fixed end-to-end:

- Created and verified `charredguard.com` as a sending domain in Resend (DKIM, SPF-MX, and
  SPF-TXT records, all scoped to a `send.` subdomain so they don't conflict with the existing
  Google Workspace mail records on the root domain).
- Added all three DNS records directly in Squarespace's DNS settings for `charredguard.com`
  (where the domain is actually managed) — required you to complete a Google re-auth step
  yourself partway through, since that's an identity check tied to your account.
- Confirmed via Resend: domain status **verified**, sending **enabled**.
- Set `RESEND_FROM_EMAIL` in wildfire-notes' Vercel env vars (Production and Preview) to
  `Field Notes <reports@charredguard.com>` — `lib/email.js` already reads this var, so it just
  needs a new deployment to take effect.

Once you push, real customer sends (report-ready emails, CRM follow-ups) should go out from
`reports@charredguard.com` instead of hitting the 403.

## Done this session (2026-08-02, round 53 — Cal.com review-call event created + wired live)

Finished what round 52 left as a manual setup step, using the Claude in Chrome browser tools
(with your go-ahead) instead of leaving it for you:

- Created a new **30-minute "Report Review Call" event type** in your Cal.com account
  (`https://cal.com/matthew-chard-nks7q3/report-review-call`), with a description explaining
  what it's for — reviewing the report together, answering questions, and discussing options
  for next steps if there's follow-up work.
- Set `CAL_COM_REVIEW_LINK` in wildfire-notes' Vercel env vars (Production and Preview) to that
  URL — takes effect on the next deployment (i.e. once you push the pending commits).
- Tightened the email copy for the "Schedule a Review Call" section in
  `lib/customerNotify.js` to spell out exactly what the call covers, per your request, instead
  of the shorter placeholder copy from round 52.

Once you push, the "Schedule a Review Call" button will actually appear in both the customer
email and the "Review before sending" preview modal — no further setup needed.

## Done this session (2026-08-02, round 52 — polish send-review email + modal, add review-call CTA)

- **Redesigned the customer report-ready email** (`lib/customerNotify.js`) — was three plain
  `<p>` tags; now a proper letterhead-style card: navy header band, centered orange CTA button,
  a boxed access-code callout, and (new) an optional "Schedule a Review Call" section inviting
  the customer to book a free 30-minute walkthrough. That section only renders once
  `CAL_COM_REVIEW_LINK` is set (see ⚠️ above) — omitted entirely otherwise, so nothing links to
  a nonexistent booking page in the meantime.
- **Redesigned the "Review before sending" modal** (`app/manage/[id]/review/page.js`) — navy
  header matching the email's own header, a bordered/striped detail table (To/Subject/Report
  link/Access code) instead of plain stacked lines, and an inline note if the review-call link
  isn't configured yet so the inspector knows why that section is missing from the preview.
- Added an optional `dark` prop to the shared `Modal` component
  (`components/ReportView.js`) so its close button switches to a light-on-dark style when a
  caller uses a dark header — needed for the navy modal header above; existing light-background
  callers (customer report's zoomed finding modal, etc.) are unaffected since the prop defaults
  to off.

Syntax-checked (babel) all three changed files.

## Done this session (2026-08-02, round 51 — follow-up fixes after round 50 review)

Testing round 50's changes (still un-pushed, see ⚠️ above) surfaced four things:

- **Finding-card order, second spot.** Round 50 reordered "Learn more about this finding" below
  the Recommendation box in the customer-facing `FindingView` (`components/ReportView.js`), but
  missed the review page's own edit-mode rendering — `EditableFinding` in
  `app/manage/[id]/review/page.js` had a second, separate copy of this layout with the same
  wrong order. Fixed to match: Recommendation always shown first, then the "Learn more" toggle,
  then the finding/rationale textareas when expanded.
- **"Where's the PDF?"** — nowhere yet, because round 50 was never pushed (see ⚠️ above); the
  production site is still running pre-round-50 code. No code change needed here, just a push.
- **Resend 403 on send** — confirmed via the Resend MCP that this is a real, separate issue:
  zero domains verified on the account, so Resend is refusing to send to anyone but the account
  owner's own inbox. Documented above; needs your action (DNS records at your registrar).
- **CRM "can't pull up the edit popup."** Added a dedicated pencil "Edit details" icon to each
  CRM row (next to the expand chevron) that opens a proper modal — name/email/phone plus,
  per-property, homeowner status/report status/lead source/lead notes (the existing
  `PropertyDetailsCard`, reused as-is). This is in addition to, not instead of, the existing
  click-to-expand row (which still shows follow-up history, payments, etc.) — the edit icon is
  a faster, focused path to the fields most often changed. New local `EditModal` component
  (theme-aware, uses the app's CSS variables — the existing `Modal` in `components/ReportView.js`
  is hardcoded to the report's own always-light palette, wrong fit for the admin CRM page).

Syntax-checked (babel) both changed files.

## Done this session (2026-08-02, round 50 — production email fixes + CRM/report batch updates)

**Part 1 — three silently-broken production systems, all missing env vars in Vercel:**

- `SUPABASE_SERVICE_ROLE_KEY` was unset, breaking server-side writes gated on it (found while
  testing the Guided Photo Assessment signup flow end-to-end).
- `NOTIFY_EMAIL` was unset, breaking the `/api/cron/report-reminders` daily digest — the cron
  route wasn't checking `sendEmail`'s `{skipped: true}` result, so it returned `{"ok":true}`
  even when nothing was sent. Fixed the env var; flagged the swallowed-skip pattern.
- `RESEND_API_KEY` was unset in production — **every transactional email the app has ever
  tried to send since deploy was silently skipped**, including customer report-ready emails
  and the reminder digest. `lib/email.js`'s `sendEmail()` treats a missing key as a no-op by
  design (so local dev doesn't need Resend configured), but nothing surfaced that in prod.
  Added the real key (Sensitive), redeployed, and confirmed via Resend's `list-emails` API
  that a real send now shows `status: "delivered"` — the two earlier "sent" confirmations this
  session were false positives, caught and corrected before being reported as fixed.

**Part 2 — four batch feature updates:**

- **CRM lead source.** `app/crm/page.js`'s customer list query never selected `lead_source`/
  `lead_notes`, so the fields existed in the UI (`PropertyDetailsCard`) but always rendered
  blank. Fixed the select, and added a lead-source badge to the always-visible collapsed row
  (previously only visible after expanding). `app/manage/page.js`'s manual property creation
  now tags `lead_source: 'manual'` (website-guided and Cal.com paths already tagged theirs).
- **PDF download on the customer report.** Browser print-to-PDF, not server-rendered — no
  headless-browser infra needed on Vercel Hobby. `/report/[token]` gained a "Download PDF"
  button that force-expands every collapsible section/finding (`forceOpen` prop threaded
  through `CollapsibleCard`/`FindingView`/`ZoneSection`), unwraps the photo carousel into a
  wrapping grid, hides the sidebar/nav, then calls `window.print()`; resets on the browser's
  `afterprint` event.
- **"Send to Customer" review-before-send flow.** Publishing (`/api/report-publish`) no longer
  auto-emails the customer on first publish — it only ever updates the public web link now.
  Every notification, first send or resend, goes through a new review modal on the review page:
  clicking "Send to Customer" calls a new read-only `/api/notify-customer-preview` endpoint
  (built from a shared `buildCustomerNotifyPreview()` in `lib/customerNotify.js`, so the
  preview is guaranteed identical to what actually sends) that returns the exact recipient,
  subject, and HTML body without sending or touching the DB; a `Modal` shows all of it plus the
  report link and access code; only clicking "Confirm & Send" calls the existing
  `/api/notify-customer` endpoint to actually send.
- **Report layout.** "Learn more about this finding" now sits below the Recommendation box
  instead of above it, on both the customer report and the review page (shared `FindingView`
  in `components/ReportView.js`).

Syntax-checked (babel) all seven changed/new files. `next build` itself can't run in this
sandbox (no arm64 SWC binary available here — unrelated to these changes).

## Done this session (2026-08-01, round 49 — booking → CRM → calendar → payments, phase 1)

First build round of the booking/payments initiative — see `BOOKING_PAYMENTS_PLAN.md` for the
full design discussion and decisions. Four pieces:

- **Add-to-Google-Calendar links.** `lib/googleCalendar.js` builds Google's plain "quick add
  event" URL — no OAuth, no token storage, no API integration. Wired into every pending
  CRM follow-up that has a due date (a calendar icon next to Send/Mark Done in the expanded
  row's history). Deliberately not real two-way sync — see the plan doc for why.
- **Discount codes.** New `crm_discounts` table + `/api/crm/discounts` (+`/[id]`) + a
  collapsible "Discount Codes" management panel on `/crm` (create/deactivate/delete, flat-$ or
  percent). Self-managed, independent of any payment processor.
- **Payment tracking.** New `crm_payments` table + `/api/crm/payments` (+`/[id]`) + a
  "Payments" section in each customer's expanded CRM row: record a payment (amount, method,
  optional discount code — validated and applied server-side, capped so it can't exceed the
  payment amount), mark paid/refunded, delete. No processor wired up yet — `method: 'stripe'`
  and a `stripe_payment_intent_id` column exist for when that's added later, but nothing
  actually charges a card. Verified the discount math (flat + percent + over-cap clamping) and
  the Cal.com payload parsing against Cal.com's documented example payload with isolated node
  tests before wiring them in.
- **Cal.com booking webhook.** New public `/api/webhooks/calcom` route — code-complete, not
  yet live (needs your Cal.com setup + signing secret, checklist in the ⚠️ section above and
  in the plan doc). Verifies Cal.com's `x-cal-signature-256` HMAC on every request (tested:
  valid/invalid/tampered/missing signatures all behave correctly), is idempotent via
  `properties.booking_event_uid` (safe against retries/duplicate deliveries), and fails loudly
  with a 422 rather than silently creating an address-less property if the required `address`
  booking question is ever missing or renamed.

Syntax-checked all ten new/changed files.

## Done this session (2026-08-01, round 48 — fix intermittent "Inspector account required" on live)

Root-caused the "Inspector account required to view this page" screen showing up randomly on
`/manage`, `/crm`, `/insights`, `/quality`, and the review page in production despite being
signed in as an inspector.

`components/AuthProvider.js` was calling both `supabase.auth.getSession()` *and* subscribing
to `supabase.auth.onAuthStateChange()` on mount — two independent async reads of the same
session state that could resolve in either order. `onAuthStateChange` already fires
immediately on subscribe with the current resolved session (event `INITIAL_SESSION`), so the
separate `getSession()` call was redundant and, worse, a race: if it happened to resolve
first and momentarily saw an unhydrated/null session, it set `user = null` and `loading =
false` — which was enough for every admin page's `if (!user || isHomeowner)` guard to render
the block screen before the correct update from `onAuthStateChange` arrived a moment later.
Timing-dependent, so it showed up more on Vercel than localhost, and "often" rather than
"always" — exactly what a race condition looks like.

Fix: removed the `getSession()` call entirely; `onAuthStateChange` is now the single source of
truth for both the initial session and subsequent changes, with `loading` only flipped to
`false` on that listener's first event. No more duplicate/racing updates.

Syntax-checked the changed file. This needs to be committed and pushed like the last round —
I don't have push credentials in this sandbox.

## Done this session (2026-07-31, round 47 — Log Contact: date/time stamp)

Fixed a real gap from round 46: logging a call/text/note wrote `completed_at` on the server
but the UI never showed it (the "Emailed/Logged" line only checked `sent_at`, which is
email-only), so a logged contact silently had no visible timestamp at all. Now:

- `LogContactForm` has a "When" `datetime-local` field, defaulted to right now but editable —
  for logging something that happened earlier rather than only "right now."
- `/api/crm/followups` POST accepts an optional `completedAt` and uses it (validated, falls
  back to now if missing/invalid) instead of always stamping the request time.
- `HistoryRow` now shows `sent_at || completed_at` with date *and* time (was date-only, and
  only for emails) for any done/logged entry; the due-date line is now only shown for still-
  pending items instead of also showing a stale "No due date" on completed ones.

Syntax-checked both changed files.

## Done this session (2026-07-31, round 46 — CRM phase 2: templates, unsubscribe, call/text log, multi-property customers)

Big round based on user feedback on what a real CRM needs. Four additions, all built on the
existing `crm_followups` log rather than new parallel systems:

- **Message templates.** New `crm_message_templates` table, seeded with 5 drafted templates
  (Annual Check-In, Home Hardening Progress Report, Service Confirmation, Seasonal Debris
  Check, General Follow-up) covering the described business patterns — one-and-done
  inspections, before/after hardening reports, basic service work (e.g. mesh installs), and a
  maybe-annual debris check. `/api/crm/templates` (+ `/[id]`) for CRUD. A collapsible
  "Message Templates" panel at the top of `/crm` lets you add/edit/delete more. `{{address}}`
  and `{{name}}` tokens get substituted when a template is picked in the Send flow.
- **Unsubscribe tracking.** `properties.unsubscribed`/`unsubscribed_at`/`unsubscribe_token`
  (a random uuid, not the property id, so the link can't be enumerated). Every follow-up email
  now has an unsubscribe link in the footer, handled by a new public (no-auth)
  `/api/crm/unsubscribe` route. `/api/crm/send-followup` refuses to send if the property is
  marked unsubscribed. Inspectors can also toggle it manually from the CRM (e.g. someone asks
  to opt out over the phone) — that applies to every property linked to that customer at once.
  One known gap: the public link only opts out the specific property tied to that token: if
  the same customer has multiple properties and clicks unsubscribe from an email about one of
  them, the others aren't automatically covered (the manual toggle in the CRM is group-wide;
  the email-triggered one isn't yet).
- **Call/text/note logging.** `crm_followups.channel` (`email`/`call`/`text`/`note`) — logging
  a call or text is just a `crm_followups` row created directly with `status: 'done'`, no
  email involved. New "Log a call or text" mini-form in the expanded row, alongside the
  existing schedule-a-follow-up form. History rows now show a channel icon and "Logged" vs.
  "Emailed" language.
- **Multi-property customers.** `/crm` now groups rows by customer identity (matched on
  email, falling back to phone, falling back to one row per property if neither is on file)
  instead of one row per property. A customer with several properties shows as a single row
  listing every linked address; editing name/email/phone updates all of them at once. The
  history/schedule/log/send actions all gained a property picker that only appears when the
  customer has more than one property (hidden for the common single-property case, so nothing
  changed visually there).
- `/api/crm/send-followup` also now leaves a history record for every send (previously only
  did if a `followupId` was passed), and accepts a `templateId` to source the subject/body.

Syntax-checked all seven new/changed files.

## Done this session (2026-07-31, round 45 — CRM: split Address/Phone columns + surface load errors)

- `/crm` table now keys off address as the primary column (was name-first, falling back to
  address) and split the old combined "Contact" column into separate Email and Phone columns
  — customer name still shows as a subtitle under the address, and is still editable in the
  expanded row.
- The properties fetch now surfaces its error instead of silently rendering an empty table.
  If `013_customer_contact.sql` hasn't been run, selecting `customer_name`/`customer_phone`
  fails the whole query (not just those two fields) — previously that meant a blank CRM table
  with no explanation. Now a banner names the actual Postgres error.

Syntax-checked the changed file.

## Done this session (2026-07-31, round 44 — CRM redesigned as a customer table)

Reworked `/crm` from a flat follow-up log into a customer table — one row per property's
customer, which is the more standard CRM shape (contacts list first, activity log as a
per-contact detail, not the landing page).

- New migration `013_customer_contact.sql` — added `customer_name` and `customer_phone` to
  `properties` (only `customer_email` existed before).
- `app/crm/page.js` rebuilt: each row shows customer name (falls back to address if no name
  on file) + address, contact info (name/email/phone, all inline-editable via a pencil icon —
  writes straight to `properties` through the browser Supabase client, no new API route
  needed), a Report status badge (draft/published/not started), the soonest pending
  follow-up (overdue ones flagged), and last-contacted date (latest of any sent follow-up
  email or the existing report-ready notification). Rows are sorted overdue-first, then by
  soonest due date. A search box filters by name/address/email/phone.
- Click a row to expand it — shows that customer's full follow-up history (same
  send/done/reopen/delete actions as before) and a schedule-a-follow-up form, now scoped to
  that customer instead of needing a property picker.
- `/api/crm/followups` and `/api/crm/send-followup` (round 43) are unchanged — same data
  model and manual-only sending, just surfaced through the new table instead of the log UI.

Syntax-checked the changed file.

## Done this session (2026-07-31, round 43 — CRM tab, phase 1: manual follow-up tracking)

First pass on the "mini CRM" idea — a new `/crm` tab for tracking per-customer follow-ups and
sending reminder emails, built on the existing Resend pipeline. Scoped deliberately: this
phase is manual only (no rules, no scheduled/automatic sends) — that's a later phase, pending
a security review of running unattended sends with the service-role key.

- New `crm_followups` table (`supabase/migrations/012_crm_followups.sql`) — one row per
  scheduled or completed follow-up touchpoint on a property (due date, note, status
  pending/done/skipped, sent_at/completed_at), not a single column on `properties`, so history
  of past follow-ups survives.
- New `/api/crm/followups` (GET list w/ property join, POST create) and
  `/api/crm/followups/[id]` (PATCH status/reschedule, DELETE), same employee-role-gated
  pattern as the lessons-learned API.
- New `/api/crm/send-followup` — manual "Send Now" endpoint. Looks up `properties.customer_email`
  (same field the report-ready email already uses), sends via the existing `sendEmail()` /
  Resend wrapper with either a custom message or a generic check-in default, and marks the
  linked follow-up done if one was passed.
- New `/crm` tab: added to `AdminSidebar` (Users icon, between Properties and Insights) and a
  new `app/crm/layout.js` mirroring the `/insights` shell (same header/back-nav/sidebar
  pattern). `app/crm/page.js` has a schedule-a-follow-up form (property picker, due date,
  note), Open/Done/All filter tabs, and per-row actions: Send Now, Mark Done, Reopen, Delete.
  Overdue pending follow-ups are flagged in the row and counted in a banner at the top.

Syntax-checked all six new/changed files (esbuild). Not yet built: any rules engine or
scheduled/automatic triggering (needs a cron mechanism — Vercel Cron or Supabase `pg_cron` —
plus the pending security review before running unattended against the service-role key).

## Done this session (2026-07-31, round 42 — corner pill, sidebar auto-scale, click-to-enlarge)

Three follow-ups on the customer report:

- Status pill overlay from round 41 moved fully flush into the photo's top-left corner
  (`top: 0, left: 0` instead of `top: 6, left: 6`).
- The TOC sidebar (`app/report/[token]/page.js`) used to stay pinned exactly `topOffset`
  (the header's height) from the top of the viewport forever, leaving a permanent blank strip
  above it once you'd scrolled the header out of view. It now tracks scroll: effective offset
  is `Math.max(0, topOffset - scrollY)`, written directly via refs on every scroll/resize
  event (not React state, to avoid a re-render per scroll pixel) — so the panel's top edge
  rises in lockstep with the page and reaches the very top once you've scrolled past where
  the header used to be, instead of wasting that space.
- Added a shared `Modal` component in `components/ReportView.js` (backdrop click + Escape to
  close, body-scroll-locked while open). `FindingView` now opens a larger, roomier version of
  the finding in that modal when clicked anywhere on the card (the existing inline "Learn
  more" toggle still works independently — click stops propagation so it doesn't also open
  the modal). `ZonePhotoGrid` now opens photos full-size in the modal on click, with prev/next
  arrows to step through the rest of that zone's photos; the lightbox shows the original
  image without the tile's zoom/pan crop, since that framing was calibrated for the small
  thumbnail. Both are shared components, so this is live on the customer report *and* the
  review page's read-mode automatically.

Syntax-checked all three changed files.

## Done this session (2026-07-31, round 41 — photo status pill moved onto the photo)

`ZonePhotoGrid`'s status pill ("✗ Non-Compliant", "? Needs Verification", etc.) used to sit
in the padded footer below each photo, next to the caption. Moved it to overlay the photo
itself, pinned top-left (`position: absolute`, plus a subtle drop-shadow filter so it reads
against busy photo backgrounds). `StatusPill` gained an optional `small` prop (10px font /
tighter padding vs. the default 11px) used here. This is the shared read-only photo grid —
live on both the customer report and the review page's read-mode automatically, no separate
change needed for either. Left the *editable* status dropdown in the review editor's edit-mode
photo footer alone, since that spot already shares the image's top corners with the zoom/
remove buttons — flag if you want that moved too.

Syntax-checked the changed file.

## Done this session (2026-07-31, round 40 — real in-page keyword search on the customer report)

The report sidebar's search box already filtered the table-of-contents list against each
section's full text (findings, recommendations, photo captions, even the disclaimer), not
just titles — but that only proved a section *contained* a match, never showed *where*.
Added actual in-page highlighting, like browser Ctrl+F: `app/report/[token]/page.js` now
walks the real DOM under a new `contentRef` (via `document.createTreeWalker`) whenever the
search query changes, wraps every matching substring anywhere in the rendered report body in
a `<mark>`, and auto-scrolls to the first hit. `ReportSidebar` gained a match counter ("3 of
7 matches") with prev/next buttons, plus Enter/Shift+Enter to step through matches while the
search box has focus. Old highlights are unwrapped and the DOM normalized before each new
search so re-searching never stacks marks. Kept the existing TOC-list filtering as-is
alongside this — both now work together.

Verified the core `highlightMatches`/`clearHighlights` DOM logic in isolation with jsdom
(multi-node matching, case-insensitivity, re-search not leaking old marks, short-query guard,
active-match styling) since this is the kind of DOM-manipulation-alongside-React code that's
easy to get subtly wrong. Syntax-checked the full file with esbuild.

**Note**: this manipulates the DOM directly outside React's own tracking, which is only safe
because this page's report content is static once loaded (a published, read-only report) —
don't reuse this pattern on a page where the underlying content can change after mount
without re-checking it.

## Done this session (2026-07-31, round 39 — logo back in the header, toggle moved to the edge)

Correction to round 38: put `BrandLogo` back in every page's header (the original two-row
logo-above-title layout, padding `18px 20px 14px`) instead of inside `AdminSidebar` — headers
are back to how they looked before that round. The collapse/expand toggle stays on
`AdminSidebar`, but repositioned: it's no longer inline at the sidebar's top next to the logo
slot, it's now a small round button floating on the sidebar's right edge (half overlapping
the border), vertically centered — `position: absolute; top: 50%; right: -12px; transform:
translateY(-50%)`, matching the reference "panel with a chevron" icon style. Sidebar's sticky
offset (`top`/`minHeight`) restored to the header's actual height (78px).

Syntax-checked all changed files.

## Done this session (2026-07-31, round 38 — collapsible sidebar with logo moved into it)

`AdminSidebar` now collapses/expands via a toggle button at its top (lucide's `SidebarClose`/
`SidebarOpen` icons — the panel-with-chevron style), width 190px expanded / 56px collapsed,
collapsed state persisted in `localStorage` (`adminSidebarCollapsed`) so it survives reloads.
Collapsed mode shows nav icons only (centered, with a `title` tooltip); the logo hides when
collapsed since there's no room for the text.

`BrandLogo` moved from every page's header into the sidebar itself, top-left, above the nav
items — headers no longer duplicate it. Since `AdminSidebar` is the one shared component used
by every admin page (`/manage`, `/manage/[id]`, `/manage/[id]/review`, `/insights/*`,
`/quality`), this single change already covers "every sidebar" in that section. Headers
dropped back to a single row (just the page title + controls) now that the logo isn't
stacked above the title — still the same height across every page.

**Scoped out**: the customer-facing report page (`/report/[token]`) has its own, unrelated
`ReportSidebar` (mobile TOC + search, already collapsible from an earlier round) — left it
alone since it serves a different purpose and audience than the admin nav.

Syntax-checked all changed files.

## Done this session (2026-07-31, round 37 — consistent header height + section title everywhere)

`/manage/[id]` and `/manage/[id]/review` had a shorter, single-row header (logo + theme
toggle only) while `/manage`, `/quality`, and `/insights` had a taller two-row header (logo +
big section title). Made the two property pages match: same padding (`18px 20px 14px`), same
logo-then-title stack, title "Properties" (matching what the sidebar highlights for both —
they're both under the Properties section). Every admin page now has the same header height
and always shows which section you're in, not just the sidebar.

Syntax-checked both changed files.

## Done this session (2026-07-31, round 36 — page actions out of the header)

`/manage/[id]`'s "Review & Publish" button lived in the sticky header — moved it into the
page itself, next to the address (right side of the same row), since the header is meant for
global chrome (logo, theme, sign out) not page-specific actions. Checked every other admin
page's header for the same pattern (`/manage`, `/manage/[id]/review`, `/quality`,
`/insights/*`) — none of them had one; this was the only offender.

Syntax-checked the changed file.

## Done this session (2026-07-31, round 35 — Lessons Learned moved into Report Quality)

Lessons Learned is no longer its own `/insights/lessons` page/sidebar entry — moved into
`/quality` as a second tab ("A/B Pairs" | "Lessons Learned"), since both are the same kind of
thing: material for improving the report-draft prompt. Extracted the note-taking UI into
`components/LessonsLearned.js` (shared, no page-level wrapper) so `/quality/page.js` just
renders it inside the tab. Deleted `app/insights/lessons/`; `AdminSidebar` no longer lists it
(now just Properties, Activity, Report Quality, with Settings pinned to the bottom).
`/insights` (Activity) is unchanged otherwise. `/api/lessons` routes are untouched — same
API, different page consuming it.

Syntax-checked all changed/new files; grepped for stale `/insights/lessons` references and
fixed the two leftover code comments.

## Done this session (2026-07-31, round 34 — one consistent sidebar + back button everywhere)

Round 33 put `AdminSidebar` only on `/manage`, and `/insights` had its own separate
Activity/Lessons/Settings sidebar — two different navs depending on where you were.
Flattened into a single `components/AdminSidebar.js` used on every inspector-facing page
(`/manage`, `/manage/[id]`, `/manage/[id]/review`, `/insights`, `/insights/lessons`,
`/insights/settings`, `/quality`): Properties, Activity, Lessons Learned, Settings, Report
Quality, all in one list, with the current page's item highlighted (`match()` per item,
checked most-specific-first so e.g. `/insights/lessons` doesn't also light up "Activity").

Every non-home page now has a `BackNav` ("← back to ...") directly under the header — added
it to `/quality`, and to `/insights` (contextual: `/insights` itself backs to Properties,
`/insights/lessons` and `/insights/settings` back to Insights Activity). `/manage/[id]` and
`/manage/[id]/review` already had one from an earlier round. `/manage` itself (the true root)
intentionally has no back button — there's nothing logical to go back to; say if you want one
anyway (e.g. back to login).

Syntax-checked all five changed files with esbuild.

## Done this session (2026-07-31, round 33 — new /insights section: activity log + lessons learned)

New standalone section, entry point via an "Insights" button in the `/manage` header next to
the existing "Report Quality" button (which is untouched — `/quality` stays as the ad-hoc
AI-draft-vs-Final JSON export tool it already was). `/insights` has its own left-sidebar
layout (`app/insights/layout.js`) with three sections:

- **Activity** (`/insights`, default) — every property's full `report_versions` history
  (every AI draft, every section edit, every "Final Report" checkpoint), grouped by property
  and expandable into a timeline with a field-level diff between each step and the one
  before it (reuses `diffSectionSlices`). Backed by a new `?scope=all` param on the existing
  `GET /api/report-version` (no-propertyId branch) — default behavior (ai_draft/final only,
  for `/quality`) is unchanged; `scope=all` opts into every source.
- **Lessons Learned** (`/insights/lessons`) — freeform notes a reviewer writes about a
  pattern worth fixing in future AI-generated drafts, optionally tied to the property that
  prompted it. New `report_lessons` table + `/api/lessons` (GET/POST) and
  `/api/lessons/[id]` (PATCH to toggle `applied`, DELETE). This is currently a **manual**
  feedback loop — the page is a browsable backlog; someone reads it and hand-edits the
  report-draft prompt. No automatic prompt injection yet.
- **Settings** (`/insights/settings`) — placeholder only, per request ("add for later").

Syntax-checked all new/changed files with esbuild; no build/runtime testing done yet since
this needs the new migration run first.

## Done this session (2026-07-31, round 32 — thin gap targets replaced with whole-item targets)

Round 31's `DropGap` z-index fix was real and confirmed via reproduction, but two more rounds
of real console logs from the user's actual browser kept showing `id: null` on every drop —
this time because their actual pointermove coordinates only ever moved a few px total per
drag gesture, never covering the 90+ px distance from a drag handle to the thin (14px)
`DropGap` strip sitting between items. Not a code bug — the design itself (a narrow strip as
the only valid drop target, positioned away from the handle) was too hard to reliably hit.

Replaced it with whole-item drop targets: each tile/row/panel is now the drop target itself
(`data-drop-target` + `data-drop-axis` on the item's own wrapper), hit-tested via
`dropTargetAt(x, y)` (`elementFromPoint` + `.closest('[data-drop-target]')`), with the
before/after insertion side decided by which half of the item's bounding box the cursor is
over. The old `DropGap` component and its separately-rendered gap elements are gone entirely;
`dropIndicatorStyle(side, axis)` now draws a thin inset-box-shadow edge highlight directly on
whichever item is currently being dragged over, so the "target area between the cards"
visual is preserved without needing a separate hit-box element. Applied identically to
photos (`EditableZonePhotos`), findings, and zone panels. `PhotoCarousel`'s now-unused
`renderGap` prop was removed from `components/ReportView.js`.

Verified via an isolated Playwright reproduction (real `page.mouse` events, not synthetic DOM
events) simulating small incremental drags in both directions — confirmed a source item
correctly reorders past a neighbor once the cursor crosses that neighbor's midpoint, in both
down and up directions. Syntax-checked both changed files with esbuild; grepped for any
remaining references to the deleted `dropGapAt`/`DropGap`/old gap-index functions — none
found.

**Needs a real-browser test** — restart the dev server (`lsof -ti:3010 | xargs kill -9` then
`npm run dev`), hard refresh, and try dragging a photo tile, a finding, and a zone panel.

## Done this session (2026-07-31, round 31 — the real bug: DropGap z-index shadowing)

Still not working after round 30's selection fix. Added temporary console logging to
`DragHandle`/`dropGapAt` in the actual file and had the user reproduce it in their real
browser — the logs showed pointerdown/pointermove/pointerup all firing correctly (drag *was*
starting), but `dropGapAt` returned `id: null` on every single check, with
`elementFromPoint` landing on a photo tile's own caption container instead of any gap.

Root cause: `DropGap`'s hit-box deliberately overlaps a few px into each neighboring
tile/row (via negative margin) so it's easier to land a pointer on than its thin at-rest
visual indicator. Its `z-index` was only elevated while a drag was `active`, but both it and
the tiles are `position: relative` — for two `position: relative` siblings at the same
z-index, DOM order decides painting, so the *following* tile (later in the DOM) always
painted over that gap's trailing overlap edge. Every gap was missing roughly a third of its
hit-box, permanently, on the side facing the next item — `elementFromPoint` would report the
tile there, never the gap. Confirmed with a targeted reproduction isolating just this z-index
condition (bug reproduces exactly; fix resolves it) in addition to the real browser
console-log evidence.

Fix: `DropGap` now always has `zIndex: 2` (not conditional on `active`), so it can never be
shadowed by adjacent content regardless of drag state.

Debug console logging (`[drag] ...`) is still present in `DragHandle`/`dropGapAt` in
`app/manage/[id]/review/page.js` — remove once confirmed working end-to-end.

## Done this session (2026-07-31, round 30 — native text-selection was hijacking the drag)

Round 29's stale-closure fix was real but incomplete — with a specific symptom reported
("the grabber selects the whole panel, but it doesn't move"), tracked down one more issue:
the browser's native click-and-drag text/content selection was taking over the gesture
instead of `DragHandle`'s own pointer logic. `preventDefault()` on the initial press doesn't
reliably stop selection from extending onto sibling content as the pointer moves during the
same gesture — a known browser quirk, not something scoped to just the pressed element.

Fixed by explicitly setting `user-select: none` on `document.body` for the duration of any
drag (photos, findings, zones), restored on release, plus clearing any selection that starts
mid-drag as a belt-and-suspenders measure. Verified with a Playwright + Chromium repro that
deliberately drags the pointer across sibling text content mid-gesture (the exact scenario
that triggers this) — confirmed no native selection occurs and the reorder completes
correctly, using the literal `DragHandle` code from the app.

## Done this session (2026-07-31, round 29 — the actual drag bug, found and verified)

Arrows confirmed fixed. Drag itself still silently did nothing on every attempt. This time,
built an isolated Playwright + Chromium repro of the exact drag mechanism (outside this
sandbox's network restrictions, using a locally-built libXdamage stub since apt access is
blocked) to actually simulate a real mouse drag rather than guess again — and found a real
bug, confirmed with both a minimal reproduction and a fix verification:

- **Root cause**: `dropInGap`/`dropInZoneGap`/`dropInFindingGap` read the dragged item's
  index from React state (`dragIndex`/`dragZoneIndex`/`dragFinding`) *inside* a closure that
  gets captured once, at `pointerdown` time, by `DragHandle`'s `window.addEventListener`
  calls. That closure freezes the state value as it was *before* `onDragStart`'s
  `setDragIndex(i)` had a chance to commit — so by the time the drop fires on release, it's
  always reading the pre-drag value (`null`), and the reorder function's guard clause
  (`if (sourceIndex == null) return`) hits every single time. No visible error, no crash —
  the drop just quietly never happens. Confirmed with a minimal repro reproducing this exact
  behavior, then confirmed the fix resolves it, using real simulated mouse events (down,
  move, up) in headless Chromium.
- **Fix**: the three drop functions now take the dragged item's index as an explicit
  function argument (`dropInGap(sourceIndex, gapIndex)`) supplied by the caller from its own
  render-time value (the tile's own `i`, the zone's own `zi`, the finding's own `fi`) —
  values that are already correct the instant the handle is pressed, no state round-trip
  needed. The `dragIndex`/`dragZoneIndex`/`dragFinding` state is now used *only* for visual
  feedback (dimming the dragged item, highlighting the active gap), where a render's worth
  of lag doesn't matter.

## Done this session (2026-07-31, round 28 — drag/arrow fixes, part 4)

Round 27 introduced a real regression (findings/zones lost `className="group"`, making
their drag handles permanently invisible — opacity stuck at 0 with nothing to trigger
`group-hover`) and the photo handle was still unusable. Rather than patch native
drag-and-drop again, replaced the whole mechanism:

- **Arrows moved out of the tile strip entirely.** After three rounds of trying to
  position them precisely enough not to overlap tile content, gave up on overlaying them at
  all — they now live in the counter row above the strip (`‹  3 / 7  ›`), in normal document
  flow. There's no tile content in that row for them to ever overlap, structurally.
- **Fixed the `className="group"` regression** on the zone-panel and finding-row wrappers —
  this alone should have restored dragging for findings and zone panels.
- **Replaced native HTML5 drag-and-drop with the Pointer Events API**, for photos, findings,
  and zone panels alike. Across four rounds, native drag hit a missing `preventDefault`, a
  missing `dataTransfer.setData`, an invisible handle, and (theorized) a conflict between
  drag-initiation and the photo strip's horizontal scroll-snap — enough distinct native-DnD
  footguns that it made more sense to stop relying on the browser's drag session and drive
  the whole gesture ourselves: `pointerdown` on the handle starts tracking, `pointermove`/
  `pointerup` on `window` follow the cursor and hit-test via `document.elementFromPoint`
  against `DropGap` elements (marked with `data-drop-id`), and drop happens on release based
  on whatever gap the pointer is actually over. Full control, no dependency on the browser's
  native drag behavior.
- **`DropGap` hit-boxes are now bigger than their visible indicator** (14px square,
  independent of the thin 3px line shown at rest) so they're actually easy to land a pointer
  on, not just visually present.

## Done this session (2026-07-31, round 27 — drag/arrow fixes, part 3)

Round 26's fixes still didn't fully hold — arrows were still off and the photo drag handle
specifically remained inert (findings/zones worked fine by then). Went deeper on both:

- **Arrows, rebuilt more robustly**: instead of one manually-computed pixel offset, arrows
  now live inside a small absolutely-positioned overlay sized exactly to the caller's
  `imageHeight` (+ optional `imageOffsetTop`), and are centered with a plain `top: 50%`
  *within that overlay* rather than within the whole (variable-height) tile. Less room for
  arithmetic mistakes than a single guessed number.
- **Photo drag handle, real fix**: it was sitting absolutely-positioned on top of the image,
  inside a horizontally-scrolling, scroll-snap track — a combination that's known to make
  native HTML5 drag unreliable to actually grab. Moved it into normal document flow in the
  tile's footer (next to the status pill), reusing the same shared `DragHandle` component
  already proven to work for findings and zones, instead of a bespoke absolutely-positioned
  div.
- **New: gap-based drop targets, replacing box-highlighting** — per feedback that the drop
  target should be *between* boxes, not on top of one. Photos, findings, and zone panels now
  render a thin `DropGap` strip between every pair of items (plus one before the first and
  one after the last); it's invisible at rest, widens with a dashed outline once a drag
  starts, and highlights solid when it's the one currently under the pointer. Dropping in a
  gap inserts the dragged item exactly there. The reorder math (`reorderZones`,
  `reorderFindings`, `onReorder` for photos) is unchanged — only what counts as "the drop
  target" changed, from an existing box to the gap next to it.

## Done this session (2026-07-31, round 26 — drag/arrow fixes, part 2)

Round 25's fixes weren't fully fixed — arrows were still overlapping and the drag handle
still didn't move anything. Root causes were different from what round 25 addressed:

- **Arrow overlap, actual cause**: the arrows were vertically centered (`top: 50%`) on the
  *whole* tile, whose height varies with caption/textarea content — not on the fixed-height
  image. `PhotoCarousel` now takes an `arrowTop` prop (a fixed pixel offset each caller
  computes from its own image height), so arrows always sit over the image regardless of how
  tall the caption text below it grows.
- **Drag handle, actual cause**: `onDragStart` never called `dataTransfer.setData(...)` —
  several browsers (Firefox, Safari) silently refuse to start a native drag session at all
  without data set on it, so the handle looked inert even though every handler was wired
  correctly. Fixed in `DragHandle` and the inline photo-tile handle.
- **New: drop-target outlines while dragging** — every valid drop target (other photos,
  findings, zone panels) now shows a faint dashed outline the moment a drag starts, and the
  one currently under the pointer gets a solid highlighted outline + tint so it's clear
  exactly where a drop will land. Applies consistently to photo tiles, findings, and zone
  panels.

## Done this session (2026-07-31, round 25 — drag-handle reorder everywhere, combined add-finding tile)

- **Fixed the carousel arrows overlapping photo captions** — the left/right nav buttons on
  `PhotoCarousel` sat at a negative offset with no compensating padding, so at narrow tile
  widths they floated on top of the first/last tile's caption text. The scroll row now
  reserves side padding for them.
- **Fixed photo drag-reorder actually being broken** — root cause was a missing
  `e.preventDefault()` in the tile's `onDrop` handler, which silently no-ops native HTML5
  drag/drop. Also replaced "whole tile is draggable" (which fought with clicking the
  remove/zoom buttons and typing in the caption box) with a small dedicated drag-handle pill
  as the sole drag trigger.
- **New reusable `DragHandle` component** — a hover-revealed grip-dots icon (Tailwind
  `group`/`group-hover`), now the one consistent drag-to-reorder affordance used for photo
  tiles, findings, and zone panels alike, replacing the old ↑/↓ step buttons everywhere they
  existed.
- **Findings can now be reordered** within a zone by dragging — previously there was no way
  to reorder findings at all. New `reorderFindings(zi, from, to)` handler + per-finding drag
  state.
- **Zone panels reorder via drag** instead of ArrowUp/ArrowDown buttons — new
  `reorderZones(from, to)` replaces the old adjacent-swap-only `moveZone`, still saves
  immediately (not gated behind a section's edit mode, since it's a structural move).
- **Combined "Add Finding" tile** — the separate "Add Finding" button and "Add Photo" upload
  control are gone. In their place, a circular "+" tile (tooltip "Add finding") appears as
  the literal last item in each zone's photo carousel strip; clicking it opens the file
  picker, uploads the photo, and appends a blank finding in one step
  (`addFindingWithPhoto`).

## Done this session (2026-07-31, round 24 — photo status/drag-reorder/zoom, toolbar reposition)

- **Photo status pill is now editable** in the review editor (same `StatusPill` component,
  `editable` mode) — previously photo tiles in edit mode didn't show a status pill at all.
  Entry-backed photos write straight to `entries.status` (source of truth for field data);
  manually-added photos store their own `status` on `zone.extraPhotos[]`.
- **"Add Finding" and "Add Photo" moved next to the photo strip** instead of being stacked
  full-width rows above/below it — now a small two-button toolbar to the right of the
  carousel.
- **Drag-and-drop photo reordering** — each tile is natively draggable; dropping it on
  another tile reorders the strip and saves `zone.photoOrder`. The existing ‹ › step buttons
  are still there too as a non-drag fallback.
- **Non-destructive photo zoom/pan editor** — a new magnifier icon on each tile opens a
  modal with a zoom slider and drag-to-recenter preview; saves a `{zoom, x, y}` transform to
  `reportData.photoAdjustments` (keyed by photo id) rather than touching the uploaded file.
  `photoTransformStyle()` in `lib/reportSchema.js` applies it consistently everywhere the
  photo renders — the editor tile, the editor's own carousel, and the published customer
  report all show the same framing.
- No new migration — everything above lives in the existing JSON blob or, for photo status
  specifically, the existing `entries.status` column.
- Syntax-checked every changed file.

## Done this session (2026-07-31, round 23 — photo carousel + full photo/panel editing)

- **Zone photo grids are now horizontal-scroll carousels** instead of a multi-row grid —
  new `PhotoCarousel` in `components/ReportView.js` (left/right arrow buttons, live "X / Y"
  counter, scroll-snap). Applied to `ZonePhotoGrid`, so this is live on both the customer
  report and the review page's read view, not just the editor.
  `ZonePhotoGrid` now takes the full zone object (not just its name) since it needs
  `zone.extraPhotos`/`zone.photoOrder` — updated both call sites accordingly.
- **Photos are now fully editable in the review page**: remove (reversible — hides the photo
  from the report via a new `reportData.excludedEntryIds` list, original field entry
  untouched, restorable from a "Hidden from report" strip), add (upload a new photo directly
  in the editor — reuses the same compress+upload path as `components/PhotoUpload.js`,
  stored on the zone as `extraPhotos`, not tied to any field entry), and reorder (‹ › buttons
  per photo, saved as `zone.photoOrder`). New `zonePhotoItems()`/`excludedZonePhotos()`
  helpers in `lib/reportSchema.js` merge entry-photos and extra-photos into one orderable,
  filterable list.
- **Zone panels themselves are reorderable** — ↑/↓ arrows in each zone's header (not gated
  by that zone's edit mode, since it's a structural move) shift the whole section earlier or
  later in the report; saves immediately rather than waiting for "Done."
- No new migration — all of this lives in the existing structured JSON blob
  (`report_draft_markdown` / `report_markdown`), just new optional keys (`excludedEntryIds`,
  `zone.extraPhotos`, `zone.photoOrder`) that default to empty/absent for older reports.
- Syntax-checked every changed file.

## Done this session (2026-07-31, round 22 — per-section report editing, version history, Report Quality portal)

- **Review page now renders pixel-identical to the published report by default.** Every
  section (Executive Summary, Site Overview, each zone, Action Plan) shows the exact
  read-only markup the customer sees — `FindingView`, `ZonePhotoGrid`, and `ActionPlanTable`
  were extracted from `/report/[token]` into `components/ReportView.js` specifically so both
  pages share the literal same components, not a visually-similar copy. A small pencil icon
  on each section's header swaps just that section into its existing editable form; a "Done"
  checkmark saves it and switches back to the read-only look. No more always-on form chrome
  across the whole page.
- **Every section save is tracked.** New `report_versions` table
  (`supabase/migrations/010_report_versions.sql`) stores a full snapshot of the report data
  every time: (a) a draft is generated (`source: 'ai_draft'`), (b) a section's "Done" button
  is clicked (`source: 'edit'`, tagged with which section), or (c) the new **"Final Report"**
  button next to Publish is clicked (`source: 'final'`) — an explicit checkpoint marking the
  current state as the one worth comparing against the original AI draft.
- **Per-section history popup**: the small clock icon next to each section's pencil opens a
  popup showing that section's change log over time — old vs. new, field by field, newest
  first — using `reportSectionSlice()`/`diffSectionSlices()` in `lib/reportSchema.js`.
- **New `/api/report-version` route**: POST records a version; GET returns either one
  property's full history (review page) or every property's `ai_draft`/`final` pairs across
  the system (the portal below).
- **New Report Quality portal at `/quality`** (linked from the `/manage` header): lists every
  property that has both an original AI draft and a "Final Report" checkpoint, with an
  expandable field-level diff per property, checkboxes, and an "Export Selected as JSON"
  button that downloads `{ propertyId, address, aiDraft, final, diff }` pairs — meant to be
  fed back into report-generation prompt improvements over time.
- Syntax-checked every changed/new file.

## Done this session (2026-07-30, round 21 — sidebar/header boundary, persistent toggle, deeper search)

- **Sidebar no longer shares a row with the header**: the header's own height is now
  measured via a ref (`headerHeight` state, remeasured on resize/report load) and the
  sidebar panel is pinned to start exactly at that height (`top: headerHeight`, `height:
  calc(100vh - headerHeight)`) instead of spanning the full viewport from y:0. The navy
  header now renders full-width and unshifted above everything (no more marginLeft on it) —
  only the content below it shifts over when the sidebar is open.
- **Toggle button is reachable at any scroll position again**: round 20 moved it inline
  into the header, which meant it scrolled away and became unreachable ("icons gone") once
  you scrolled past the top. It's back to `position: fixed` (always on screen) but now
  pinned just below the measured header height, so it can never land on top of the header's
  own title text either.
- **Search now covers the whole page, not just structured section fields**: each TOC
  entry's searchable content blob now also includes the header/property info (address,
  inspector, visit date), the intro/footer disclaimer copy, the overall risk rating, and
  per-zone photo captions — on top of the finding/recommendation/rationale/action-plan text
  already indexed in round 20.
- Syntax-checked the file.

## Done this session (2026-07-30, round 20 — TOC sidebar polish: header overlap, color, search scope)

- **Toggle button no longer overlaps the header**: the round-19 sidebar toggle was a
  `position: fixed` button at a raw pixel coordinate, which landed on top of the navy
  header's own title text. Moved it into the header itself (normal document flow, next to
  the "🔥 Wildfire Risk Reduction Assessment" label) so it structurally can't overlap
  anything — it just moves with the header wherever the header is.
- **Sidebar recolored to match the page**: was navy (matching the header), now uses the
  same light background/border/text colors as the rest of the report for a more unified
  look. Added an explicit "✕" close button inside the panel since it's no longer the same
  color as its own toggle affordance.
- **Search now matches anything in the report**, not just section titles — each TOC entry
  now carries a lowercased blob of its section's actual content (finding text, statuses,
  recommendations, rationale, action items, zone-guide body copy) and the search box
  filters against title OR content.
- Syntax-checked the file.

## Done this session (2026-07-30, round 19 — TOC as a collapsible searchable left sidebar)

- **`/report/[token]`**: replaced the inline "Table of Contents" card with a fixed left
  sidebar panel — collapsible via a small tab button (‹ / ☰) that stays visible either way,
  with a search box that filters the section list live. On desktop it pushes the report
  content over (open by default); on narrow screens it behaves as a full-height overlay
  drawer with a dismissible backdrop instead of squeezing the reading width, and starts
  closed. Width/behavior is tracked via a `resize` listener rather than CSS media queries,
  since this file is all inline styles — initializes to the "mobile, closed" state so the
  first client render matches the server-rendered HTML, then corrects itself in a
  `useEffect` right after mount.
- Old inline `TOC` component removed (fully superseded by the sidebar); everything else on
  the page — risk badge, findings, action plan, zone guide — unchanged.
- Syntax-checked the file.

## Done this session (2026-07-30, round 18 — trim finding redundancy, AI photo captions)

- **Finding cards were showing the same thing twice**: the inline "finding" paragraph and
  the rationale tooltip both explained the same issue in different words. Now only the
  **recommendation** is always visible; category + status pill sit above it, and a
  **"Learn more about this finding"** text button (replacing the small ⓘ icon) expands to
  show the finding description + rationale together. Applied to both `/report/[token]`
  (closed by default) and the review editor (open by default, since you're editing those
  fields — still has the same toggle so you can preview the closed state).
- **AI-generated photo captions**: photo captions used to just be the inspector's raw field
  note (e.g. "Shrubs within 5' of house"). `/api/report-draft` now also asks the AI for a
  `photoCaptions` map (keyed by entry id) with actionable phrasing — "Remove shrubs within 5
  ft of the house to meet defensible space requirements" for non-compliant items, a brief
  confirmation for compliant ones. New `getPhotoCaption()` helper in `lib/reportSchema.js`
  reads that map with a fallback to the raw note for older reports. Editable inline in the
  review page's photo grid, read-only on the customer report.
- Syntax-checked all 4 changed files.

## Done this session (2026-07-30, round 17 — photos in review editor + light/dark clash fix)

- **No photos in the review editor**: the round-16 rebuild only ever fetched an entries
  *count* on that page, never the rows themselves, so there was nothing to match photos
  against. Now fetches full entry rows (zone/photo_url/note/ai_caption) and shows the same
  per-zone photo grid the published report shows, inside each zone card.
- **"Weird light and dark theme stuff"**: the report canvas (and the published report page)
  use fixed light brand colors on purpose — regardless of the inspector's app theme or
  the viewer's OS setting, since it's meant to look identical for every customer. But
  native form chrome (scrollbar thumbs, etc.) still follows the OS/browser dark-mode
  preference unless told otherwise, so a light-mode textarea sitting under a dark-mode OS
  was getting dark-styled scrollbars — a real mismatch. Fixed by setting `colorScheme:
  'light'` on the report canvas wrapper (review page) and all four page states of
  `/report/[token]`, forcing native controls to render light regardless of OS/app theme.
- Syntax-checked both files.

## Done this session (2026-07-30, round 16 — true WYSIWYG review editor + two UI fixes)

- **"Is there a way to edit while it's in its final web report format?"** — yes, and now it
  actually does that (round 14 built a plain form editor with the right data, but not the
  right look). New **`components/ReportView.js`** holds the shared visual pieces (colors,
  `StatusPill`, `RiskBadge`, `CollapsibleCard`) used by *both* the customer report and the
  review page, with `editable`/`onChange` modes on the pill and risk badge so they render as
  native selects styled identically to their read-only look. `/manage/[id]/review` now
  renders the actual navy-header/status-pill/finding-card report layout with every field —
  risk rating, narrative text, top priorities, findings (category/finding/status/
  recommendation/rationale), action plan — editable in place as blended, borderless inputs
  that only show a focus ring when you click in. `/report/[token]` was refactored to import
  the same shared pieces instead of duplicating them, guaranteeing they stay visually
  identical.
- **Guided Entry step-nav clipped behind its header**: the nav pill row was pinned with a
  hardcoded `top: 66` guess for the header's height, which no longer matched — the header
  (stacked on top) was covering all but a thin sliver of it. Fixed by merging the header and
  step-nav into one shared sticky wrapper, so there's no offset to guess at all.
  Also added left/right arrow buttons flanking the step-nav row (disabled/dimmed at each
  scroll end) so it's tap-scrollable on mobile, not just swipe-scrollable.
- Syntax-checked all 4 changed/new files.

## Done this session (2026-07-30, round 15 — two report-draft fixes)

- **"Unexpected end of JSON input" on generate**: the AI's structured JSON response was
  getting cut off mid-generation — with per-finding recommendation+rationale now added for
  every entry, the payload for a property with a lot of entries exceeded the 4,500-token
  cap. Bumped to 8,000 and split the try/catch so a genuine truncation (`stop_reason ===
  'max_tokens'`) now returns a clear "try again" message instead of a cryptic parse error.
- **Per-side findings were too granular**: entries logged per side (Front/Left/Right/Back)
  under the same WPH zone (e.g. Vents logged 4 times) were each becoming their own finding
  row. Updated the prompt rules so same-zone entries across sides get merged into ONE
  finding per category — matching the original category-level reporting structure — with
  status reflecting the least-compliant side and the finding text calling out which side(s)
  differ, rather than listing every side separately.
- Syntax-checked `app/api/report-draft/route.js`.

## Done this session (2026-07-30, round 14 — nav back buttons/logo + structured report editing)

Two asks: consistent navigation across the inspector pages, and reworking the report itself
so findings pair with their recommendation, rationale is tucked behind a tooltip, and the
review step edits the actual report instead of raw markdown.

**Navigation:**
- New shared **`components/BrandLogo.js`** — the "Field Notes · Wildfire Inspection" mark,
  now clickable everywhere, always goes to `/manage` (home).
- New shared **`components/BackNav.js`** — a thin, non-sticky strip directly under the
  sticky header with just a "← back to [parent page]" link. `/manage/[id]` → All
  Properties; `/manage/[id]/review` → back to that property.
- Wired into all three inspector pages (`/manage`, `/manage/[id]`, `/manage/[id]/review`).

**Report restructure** (you picked: full structured rebuild, and replace the markdown
editor entirely):
- The AI (`/api/report-draft`) now returns structured JSON instead of a markdown blob —
  executive summary fields, a site overview paragraph, `zones[].findings[]` with
  `category/finding/status/recommendation/rationale` per finding, and a structured action
  plan. Still stored in the same `properties.report_draft_markdown` /
  `shared_reports.report_markdown` text columns (didn't rename them — lower risk, they just
  hold JSON now) via `lib/reportSchema.js`, which is shared by the generator, the editor,
  and the customer page.
- **`/manage/[id]/review`** is now a real editor, not markdown+preview: risk rating
  dropdown, narrative fields, per-zone finding cards (category/finding/status/
  recommendation/rationale, add/remove), add-a-zone, and an editable action plan table.
  Every field maps directly onto what the customer sees.
- **`/report/[token]`**: each finding now shows its recommendation directly underneath it,
  and the rationale ("why this status") lives behind a small tap-to-open ⓘ icon next to the
  status pill instead of being written out inline — built as click/tap-toggle rather than
  hover, since most homeowners will read this on a phone.
- **Backward compatible**: any report published before this change is a plain markdown
  string, not JSON. Both the review page and the customer page detect that (JSON.parse
  fails) and fall back to the original markdown-rendering/editing path unchanged, rather
  than breaking already-shared links.
- Syntax-checked all 4 changed/new files (`lib/reportSchema.js`,
  `app/api/report-draft/route.js`, `app/manage/[id]/review/page.js`,
  `app/report/[token]/page.js`) — clean.

## Done this session (2026-07-30, round 13 — restructured /manage: tabs → embedded notes + dedicated review page)

You asked for this directly, with three explicit clarifying questions answered first (review
flow location, site-notes format, priorities cleanup depth):

- **Site Notes embedded in Guided Entry.** The old standalone tab (15 freeform fields in a
  `site_notes` table keyed only by property_id) is gone. Each Guided Entry step — Overall
  Site + all 7 walkthrough segments — now has its own "Notes" box, saved onto
  `guided_segments.notes` (already keyed by property_id + segment_key, so it just needed a
  new column). Migration **009** adds it.
- **Priorities tab deleted.** `components/Priorities.js` removed, no longer imported. Per
  your answer, the underlying `priorities` table and `/api/report-draft`'s prompt section
  for it are untouched — it'll just always read "(none set)" going forward. Easy to bring
  back later if you want it.
- **Report tab deleted, moved to its own page: `/manage/[id]/review`.** All of it — customer
  email edit, generate/regenerate draft, save, preview toggle, publish/republish, send/resend
  to customer — moved as-is, just relocated. `/manage/[id]` is now Entries-only (no more tab
  nav), with a "Review & Publish" button in the header (disabled until there's at least one
  entry) linking to the new page.
- **New Review column on `/manage`.** Replaces the old static "Report" badge column. Shows
  "Add entries first" (muted, non-interactive) until a property has entries, then a
  clickable pill — "Start Review →" / "Continue Review" / "Published ✓" depending on
  `report_status` — linking straight to `/manage/[id]/review`. This is the "column that
  enables initiating a review process" you asked for.
- **`app/api/report-draft/route.js`** rewired to read segment notes from `guided_segments`
  instead of the old `site_notes` table (Overall Site + all 7 segments, matched to their
  labels).
- Deleted `components/SiteNotes.js` and `components/Priorities.js` (had to request file-delete
  permission for the folder first — now enabled).
- Syntax-checked all 6 changed/new files (`lib/criteria.js`, `components/GuidedEntry.js`,
  `app/api/report-draft/route.js`, `app/manage/[id]/page.js`, `app/manage/[id]/review/page.js`,
  `app/manage/page.js`) — clean.
- **Not touched, out of scope**: `components/ExportPanel.js` and `components/FireData.js`
  still reference the old `site_notes`/`priorities` tables directly — these were already
  orphaned (not linked from any current page) before this session, per the earlier unresolved
  Fire Data/Export question. Left alone.

## Done this session (2026-07-30, round 12 — fix: customer email shouldn't require an invite)

Correctly called out: most inspections are done in person by the inspector with no
homeowner ever invited, but the customer-notify flow only worked by finding an email from
a *used* homeowner invite — so it silently couldn't work for the majority of properties.

- **`supabase/migrations/008_customer_email.sql`**: adds `properties.customer_email`, a
  contact email set directly on the property, independent of the homeowner self-service
  flow entirely.
- **`lib/customerNotify.js`**: now checks `properties.customer_email` first; only falls
  back to the homeowner-invite lookup if that's empty (so properties that *did* onboard a
  homeowner still work without needing the field filled in separately).
- **`/manage/[id]` Report tab**: added an inline-editable "Customer email" field (same
  click-to-edit pattern as the address field) right above the generate/publish buttons —
  shows a visible warning-colored placeholder ("Not set — reports can't be emailed...")
  when empty, so it's obvious before you even try to send.
- **`/manage` "+ New Property" form**: added an optional customer-email input at intake
  time too, so it can be captured up front during an in-person inspection rather than
  needing to remember it later.
- Syntax-checked all three changed files.

## Done this session (2026-07-30, round 11 — automatic customer report delivery)

Clarified scope: the review pipeline gap you meant was the *post-inspection* flow —
generate report → review/edit as markdown (already built) → the published web version
being genuinely polished (turns out `/report/[token]` already is — access-code gated,
risk badge, collapsible sections, styled compliance tables, zone guide, photo grid) →
and getting it to the customer automatically, which was the actual missing piece.

- **`supabase/migrations/007_customer_notify.sql`**: adds `properties.customer_notified_at`.
- **`lib/customerNotify.js`** (new): shared helper — looks up the homeowner's email from
  their most recent *used* invite (not `profiles`, which doesn't store email), builds the
  report link + access code, sends via the existing `lib/email.js`/Resend wrapper, and
  timestamps `customer_notified_at` on success.
- **`/api/report-publish`**: now auto-sends this email, but only on the *first* publish
  (new token creation) — republishing after an edit reuses the same link, so no repeat
  email. Failures here are non-fatal to the publish itself (e.g. no homeowner invited yet).
- **`/api/notify-customer`** (new): manual trigger for the same send, employee-only —
  powers a "Send to Customer" / "Resend to Customer" button and status line in the Report
  tab's published-link banner, mirroring the existing "Resend Notification" pattern already
  used elsewhere in the app.
- **Known limitation, same as before**: this will hit the Resend sandbox restriction
  (`onboarding@resend.dev` can only deliver to your own verified Resend account email, not
  arbitrary customer addresses) until `charredguard.com` is verified as a sending domain.
  Built and ready to go once that's resolved — for now, only testable if the homeowner
  email on file happens to be your own.
- Syntax-checked all four changed/new files; grepped for consistent wiring across all of
  them — clean.

## Done this session (2026-07-30, round 10 — dropped dots, simplified, wired into reports)

The dot-on-photo approach still wasn't landing reliably after two attempts. Rather than
keep tuning it, reverted to the simpler design and spent the effort on making the analysis
actually useful elsewhere instead:

- **`/api/satellite-analysis`**: back to a plain per-segment text list (no house_bounds, no
  front_side, no coordinate geometry — all removed). Image request changed from
  `zoom=20&size=640x640` to `zoom=21&size=400x400&scale=2` — zoom is already maxed for
  satellite tiles, so the way to crop tighter on the house is a smaller frame size at that
  same zoom (less area shown, not a "more zoomed" tile), with `scale=2` keeping detail high
  despite the smaller frame.
- **`lib/satellite.js`** (new): `parseSatellite`/`getAreaText` extracted into a shared,
  dependency-free helper module so both `GuidedEntry.js` (client) and `report-draft`
  (server) read the same saved analysis consistently.
- **`GuidedEntry.js`**: Overall Site step now just shows the (tighter) photo followed by a
  plain per-category text list underneath — no dots, no bounding box, no compass. Also
  fixed the nav pill row rendering as tall/empty boxes — missing `alignItems: 'center'` on
  the flex container meant pills stretched to the row's cross-axis height by default;
  added that plus `boxSizing: 'border-box'` and explicit `lineHeight` on each pill.
- **`report-draft`**: satellite observations are now included as a labeled, clearly-marked
  "tentative, unconfirmed" section in the context sent to the report-generation prompt,
  with explicit instructions that it may inform the narrative overview but must never
  appear as a FINDINGS BY CATEGORY row or a compliance determination — only confirmed
  ENTRIES data can do that. This was the other half of "make sure the synthesized analysis
  gets included in the logic for inclusion for items to investigate throughout the
  inspection" — the per-segment banner during the walkthrough already existed, this closes
  the loop into the actual report output too.
- Syntax-checked all four changed/new files; grepped for leftover references to the removed
  dot/box logic — none found.

## Done this session (2026-07-30, round 9 — corner driveways + tighter dots + sharper image)

Live feedback: house box was correct, but the driveway was at a corner ("bottom right"),
which the 4-direction model couldn't express, and dots sat too far from the roof.

- **`front_side`** now accepts 8 directions (4 cardinal + 4 corners: `top-left`,
  `top-right`, `bottom-left`, `bottom-right`), since driveways are often at a corner of the
  house rather than centered on one wall. Geometry rewritten to use unit vectors + 90°
  rotation instead of a lookup table, so corner directions work exactly like cardinal ones.
- **Dots pulled in much closer to the house** — front/back/left/right margin reduced from
  40% of the box's half-width/height to 18%; veg/structures (further-out zone dots) reduced
  from 220% to 55%.
- **Sharper source image**: zoom bumped from 20 to 21 (as far in as Static Maps satellite
  goes) and added `scale=2` for double pixel density at the same framing — more detail for
  the AI to work with, same cost order of magnitude (still fractions of a cent).
- Verified the new vector-based geometry with a Node script for a bottom-right diagonal
  case — front/back/left/right rotate correctly around the diagonal, confirmed via output.

## Done this session (2026-07-30, round 8 — geometry-based dots, not AI-guessed)

Round 7's "reason step by step, then guess coordinates" approach was still way off — dots
scattered across neighboring properties. Root cause: asking a vision model to directly
output 7 independent x/y coordinate pairs is just a hard task regardless of prompting.
Restructured to make the AI's job much smaller and everything else deterministic:

- **`/api/satellite-analysis`**: the AI now only does two things — draw a bounding box
  around the target house (`house_bounds`) and say which single edge the driveway touches
  (`front_side`: top/bottom/left/right). Per-segment fields are back to plain text only, no
  coordinates. A new `computeDotPositions()` function takes that box + side and computes
  all 7 dot positions with plain geometry (front/back/left/right just outside their edge of
  the box, overhead at the box center, veg/structures further out on the diagonal). Falls
  back to a centered box if the AI's `house_bounds` is missing/malformed, so it can't crash.
- **`GuidedEntry.js`**: now draws the AI's `house_bounds` as a dashed box directly on the
  photo, so it's immediately obvious whether the AI actually found the right house — if the
  box is wrong, you'll see it at a glance instead of just wondering why dots look off. The
  orientation caption now reads the `front_side` value directly instead of parsing a
  sentence.
- Verified the geometry function with a standalone Node script — confirmed symmetric
  placement, center-anchored overhead dot, and correct fallback behavior when bounds are
  missing.
- Still not a guarantee — the one AI judgment call that remains (finding the house and its
  bounding box) can still be wrong, especially in dense neighborhoods with similar homes.
  But this is a much smaller, more visually-checkable failure mode than before, and the
  house_bounds box being visible means you'll know immediately if that's the problem.

## Done this session (2026-07-30, round 7 — dot accuracy attempt)

First live test showed dots scattered/misplaced relative to the actual house. You declined
the "drag to correct" fallback (fair — it'd mean redoing it per property forever, and one
correction can't generalize to a different property's photo/orientation). Instead, tried
to improve the AI's own accuracy:

- **`/api/satellite-analysis`**: prompt now forces a reasoning sequence before coordinates
  — estimate the house's own bounding box first, then state where the driveway meets the
  house (declaring that the front) and reason about back/left/right from there, and only
  then fill in x/y per segment. Added `house_bounds` and `orientation` fields to the JSON
  so this reasoning is explicit, not just implicit.
- Bumped the model for this call from Haiku to **Sonnet** (`claude-sonnet-4-6`) — this only
  runs once per property, so the cost difference is still negligible, and Sonnet should be
  meaningfully better at this kind of spatial reasoning than Haiku.
- **`GuidedEntry.js`**: now shows the AI's `orientation` reasoning as a small caption near
  the image, so it's easy to see *why* dots ended up where they did, and spot when the
  reasoning itself was wrong even without a way to correct it.
- **No accuracy guarantee** — this is a genuine limitation of vision-language models doing
  spatial localization on an unlabeled photo, not a bug. If dots are still notably off
  after this, worth revisiting whether the dots pull their weight vs. just keeping the
  text-list fallback (already built, kicks in automatically if `satelliteImageUrl` isn't
  set) as the primary UI.
- Syntax-checked both changed files.

## Done this session (2026-07-30, round 6 — satellite image + clickable area dots)

The satellite feature is now fully working end-to-end (after resolving: Maps Static API
needing to be enabled separately from Geocoding/Places, and Google Cloud billing needing
to be "Activated," not just signed up for the free trial — both were blocking the same
new API key). On top of that, per your request:

- **`/api/satellite-analysis`**: now uploads the fetched satellite image to Supabase
  Storage (`entry-photos/satellite/<propertyId>.png`, upserted on re-analysis) and returns
  its public URL. The AI prompt was also upgraded to return `{ text, x, y }` per segment
  instead of a plain string — `x`/`y` are best-effort percentage positions (0-100) within
  the image, estimated from visible cues like the driveway/street to infer front vs. back.
  Also fixed a stale bug where the JSON schema example still listed the old `access` and
  `overall_site` keys (removed in earlier rounds) — it's now generated dynamically from
  `GUIDED_SEGMENTS` so it can't drift again.
- **`GuidedEntry.js`**: the Overall Site step now shows the actual satellite photo with a
  clickable dot per segment (front/left/right/back/overhead/veg/structures) — tap a dot to
  see that area's note in a detail box below the image. A compass indicator (fixed "N ↑" in
  the corner) is always accurate since Static Maps images are north-up by default with no
  rotation parameter used — no AI guessing needed for that part. Added `getAreaText`/
  `getAreaCoords` helpers so older saved analyses (plain-string format, no image) still
  render via a text-list fallback instead of breaking.
- Position estimates are explicitly best-effort — the AI is reasoning about a top-down photo
  with no ground-truth orientation data, so a dot landing in roughly the right area rather
  than pixel-precise is expected and fine for this tentative pre-flight tool.
- Syntax-checked both changed files, plus a standalone Node check confirming the old/new
  format parsing helpers behave correctly.

## ⚠️ Action required — new migration + npm install (previous round)

- Run `supabase/migrations/004_report_pipeline.sql` in the Supabase SQL editor — adds
  `report_status`, `report_draft_markdown`, `shared_report_token` to `properties`.
- Run `npm install` before starting the dev server — added the `marked` package
  (for rendering the report preview) to `package.json`.

## Done this session (2026-07-30, round 5 — per-side coverage fix + Overall Site items)

Confirmed via clarifying questions: (1) siding gets one general note on Overall Site, in
addition to the existing per-side siding checks — you confirmed this one directly; (2)
decks/patios and (3) vents/gutters/eaves scope defaulted to the recommended options since
you didn't respond to those two — flag it if you'd rather have them differently.

- **Overall Site**: `wholeSidePhoto` set to `false` (no more whole-property photo/gap-check
  prompt there — the satellite scan already covers it). Added a **Primary siding material**
  item as a general pre-walk note.
- **Vents, Gutters & downspouts, Eaves & soffits** moved from a single Overhead-only check
  to per-side items on Front/Left/Right/Back (assumed default: all three, not just vents —
  let me know if you only wanted vents added and the rest left at Overhead).
- **Overhead** now just holds Roof covering + Skylights — the two things that are genuinely
  whole-building rather than per-side.
- **Decks/Patios (if present)** added to Front, Left, and Right (assumed default — previously
  only on Back).
- Segment items per side went from 5-6 up to 9-10; verified via a Node import check
  (front=10, left/right/back=9, overhead=2, overall_site=5) and an esbuild syntax check on
  both changed files.

## Done this session (2026-07-30, round 4 — Access & Driveway folded in too)

- **`lib/criteria.js`**: `access` (driveway/access route) removed from `GUIDED_SEGMENTS`
  and merged into `OVERALL_SITE_SEGMENT`'s items list.
- **`GuidedEntry.js`**: the combined first step is now labeled **"Overall Site"**
  everywhere (nav pill + page heading — dropped the separate "Satellite" label), and
  contains: the satellite scan, the street/terrain/neighbor checklist, and the driveway/
  access item, all under one step with one whole-property photo + gap check.
- Walkthrough order is now: **Overall Site (satellite + site + access) → Front → Left →
  Right → Back → Overhead → Vegetation → Structures**.
- Syntax-checked both changed files; confirmed the only remaining `key: 'access'` in the
  codebase is the unrelated `SITE_NOTE_SECTIONS` entry (Site Notes tab), not touched.

## Done this session (2026-07-30, round 3 — Overall Site folded into Satellite step)

Per feedback, "Overall Site" is no longer a separate segment at the end of the
walkthrough — it's merged into the Satellite Overview step at the start, since
stepping back for wide property/terrain/neighbor shots pairs naturally with the
overhead scan.

- **`lib/criteria.js`**: `overall_site` removed from the `GUIDED_SEGMENTS` walkthrough
  array; exported separately as `OVERALL_SITE_SEGMENT` instead.
- **`GuidedEntry.js`**: the first step (`Satellite`) now combines the satellite scan UI
  with the Overall Site checklist (street shot, terrain, neighboring properties) and its
  own whole-property photo + gap check — it behaves like any other segment (checklist,
  photo, gap-check, done-count in the nav pill) with the satellite-scan controls layered
  on top.
- **`/api/segment-analysis`**: now resolves `segmentKey === 'overall_site'` against the
  separately-exported `OVERALL_SITE_SEGMENT` so the gap-check still works for the combined
  step.
- Walkthrough order is now: **Satellite/Overall Site → Front → Left → Right → Back →
  Overhead → Vegetation → Structures → Access**. All steps share one skip-around nav.
- Syntax-checked all three changed files.

## Done this session (2026-07-30, round 2 — satellite-first flow)

Adjusted the walkthrough per feedback: satellite analysis is now step 1, before Front —
not an optional side panel.

- **`GuidedEntry.js`**: the top nav is now `Satellite → Front → Left → Right → Back →
  Overhead → ...` — one combined skip-around pill bar covering the satellite step and
  every segment, so you can jump anywhere at any time.
- **Satellite step** is now a full page of its own (opens by default): "Analyze Satellite
  View" scans the whole property once, and the result is broken out **per category**
  (front/left/right/back/overhead/veg/structures/access/overall) rather than one blob —
  `/api/satellite-analysis` now asks Claude for structured JSON keyed by segment.
- When you land on any real segment, if the satellite scan flagged something for that
  specific category, it shows as a banner above the checklist ("◈ From the satellite
  scan: ..."), separate from the per-segment ground-photo gap check banner below.
- Syntax-checked both changed files (`app/api/satellite-analysis/route.js`,
  `components/GuidedEntry.js`).

## Done this session (2026-07-30, round 1 — location-first Guided Entry redesign)

Rebuilt `GuidedEntry.js` from scratch per your request to drop the old Step-by-Step /
Full Checklist mode picker in favor of a single location-first walkthrough:

- **`lib/criteria.js`**: replaced `GUIDED_CHECKLIST` (category-first) with
  `GUIDED_SEGMENTS` (location-first) — Front → Left → Right → Back → **Overhead**
  (everything at/above the soffit line, checked once for the whole building) → 5-30ft
  Vegetation → 10-30ft Structures → Access/Driveway → Overall Site. Each item still
  carries the original `zone` value so entries slot into the same report grouping as
  before.
- **`components/GuidedEntry.js`**: full rewrite. Persistent pill nav across the top lets
  you jump to any segment out of order (with a live done-count per segment); each
  checklist item expands inline to log a photo/status/note without leaving your place;
  each segment has a "whole-side photo" + **Run Gap Check** button that sends that photo
  plus the segment's logged entries to Claude (Haiku, vision) and shows a soft suggestion
  banner — never auto-creates entries, just flags what's worth a second look.
- **Satellite pre-flight panel**: collapsible section at the top of the Guided Entry
  overlay. **Analyze Satellite View** fetches a Google Static Maps satellite image for
  the property's saved lat/lng and runs one Haiku vision pass, flagging large visible
  features (structures, tree canopy, decks, driveway) as tentative-only candidates before
  you start walking. Result is cached on `properties.satellite_analysis`.
- **New API routes**: `/api/satellite-analysis` (employee-only, whole-property scan) and
  `/api/segment-analysis` (employee-only, per-segment gap check) — both use
  `claude-haiku-4-5-20251001` for cost/latency, matching the design intent of one cheap
  call per checkpoint rather than one per photo.
- `/manage/[id]/page.js` now passes its already-fetched `entries` and `property` into
  `GuidedEntry` as props instead of having it re-query — avoids a duplicate fetch on open.
- All new/changed files passed an esbuild syntax check.

**Not done yet from the original design doc, still open**: the deterministic compliance
rules engine, and folding the pre-flight Google Elevation/slope lookup in alongside the
satellite imagery pass (satellite imagery itself is now done; slope is not).

## Done this session (2026-07-29, round 3 — admin properties table + report pipeline)

Full admin re-org, replacing the old `/manage` (homeowner-submissions-only list) with:

- **`/manage`** — table of ALL properties (not just ones with homeowner activity):
  address, inspector, visit date, entry count, homeowner-status badge, report-status
  badge. Search by address. Row click → `/manage/[id]`.
- **`/manage/[id]`** — full property review page with tabs: Entries (reuses
  `EntriesList`), Site Notes, Priorities, and **Report**.
- **Report pipeline** (the "streamlined review process"):
  1. **Generate Draft Report** — `/api/report-draft` synthesizes a markdown report from
     the property's entries/site notes/priorities via Claude. Saved to
     `properties.report_draft_markdown` — this is private, not visible to anyone outside
     the app yet (no `shared_reports` row created at this stage).
  2. **Edit** — built-in markdown textarea + live-rendered preview side by side (using
     `marked`), with a **Save Draft** button. You can freely rewrite anything before it's
     ever public.
  3. **Publish** — `/api/report-publish` copies the current draft into `shared_reports`
     (the same table that already powers the customer-facing `/report/[token]` page).
     First publish generates a token + 6-digit access code; every publish after that
     updates the same live link in place rather than creating a new one, so a link you've
     already shared with a client keeps working after edits.
- Chose the markdown-editor-plus-preview approach over a rich-text/WYSIWYG editor to
  avoid a heavier dependency and stay consistent with how reports are already stored
  and AI-generated (as markdown).

## ⏸️ Paused — charredguard.com domain is on an ICANN hold

Root cause of the "email notification not arriving" investigation: `charredguard.com`
was registered ~2 months ago through Squarespace (via Google Workspace signup), and the
mandatory ICANN post-registration email verification (required within 15 days of any
registration/transfer/contact change) was never completed. The domain is suspended as a
result — no DNS resolves at all (confirmed via public lookups: no A, MX, or NS records),
which is also why Google Workspace shows MX/SPF/DKIM as missing/incorrect, and why the
Resend notification email never arrived at contact@charredguard.com.

**You're currently handling this directly with Squarespace support** — call summary is
above in chat if you need to re-paste it. Once the domain is verified/unsuspended and DNS
is working again:
1. Confirm `contact@charredguard.com` can send/receive mail normally
2. Retry the "Resend Notification" button on `/manage` for the test property, or have the
   homeowner click "Notify my inspector again"
3. If deliverability is still shaky after that, revisit verifying `charredguard.com` as a
   sending domain in Resend (Domains → Add Domain) so notification emails come from
   `notifications@charredguard.com` instead of the shared `onboarding@resend.dev` test address

The `NOTIFY_EMAIL=contact@charredguard.com` env var and the whole notification pipeline
(Finish button → `/api/homeowner/finish` → `lib/email.js` → Resend) is already built and
was confirmed working mechanically (Resend accepted the send) — this is purely a domain/
DNS/email-deliverability issue outside the app itself, not a bug to fix in code.

## ⚠️ Action required before this round of work goes live

**1. Run two migrations** in the Supabase SQL editor (in order):
- `supabase/migrations/002_add_invite_email.sql` — adds the email column to invites (from the email-lock feature)
- `supabase/migrations/003_homeowner_status.sql` — adds `homeowner_status` + `homeowner_submitted_at` to `properties`, powers the new `/manage` dashboard

**2. Get a Resend API key** (for the "notify me when homeowner finishes" email):
- Sign up free at [resend.com](https://resend.com) (3,000 emails/month free, no card needed)
- Skip domain verification for now — the shared `onboarding@resend.dev` address works immediately
- Dashboard → API Keys → Create → copy it
- Add to `.env.local`: `RESEND_API_KEY=re_...`
- Restart the dev server after adding it (env vars only load on startup)

Without the Resend key, everything else still works — email sends are just skipped (logged to the terminal, not thrown as an error).

## Done this session (2026-07-29, round 2 — notification system)

- **Homeowner "Finish" flow**: `HomeownerHome.js` now has an "I'm Done — Send to My Inspector"
  button. Clicking it sets the property's status to `submitted`, timestamps it, and emails
  the inspector who created the property (looked up via `properties.created_by`). Homeowner
  sees a confirmation banner ("your report will be ready within 48 hours") and can still add
  more entries afterward without re-triggering the email.
- **`/manage` dashboard** (employee-only, linked from the main app header): lists every
  property that's had a homeowner invited, grouped into New Submissions / In Progress /
  Invited / Done. "Open" jumps straight to that property in the main app
  (`/?property=<id>` deep link). "Mark Done" lets you close out a submission after
  generating its report.
- **Status lifecycle** added to `properties.homeowner_status`: null → `invited` (invite sent)
  → `in_progress` (homeowner added their first entry) → `submitted` (homeowner hit Finish)
  → `done` (you mark it reviewed). Transitions happen automatically in the API routes.
- **Email**: `lib/email.js` wraps Resend's REST API directly (no SDK/npm install needed).
  Fails soft — if `RESEND_API_KEY` isn't set, it logs and skips instead of breaking the request.

## Done earlier (2026-07-29, round 1 — email lock)

**Homeowner invite email lock** — invites are now generated for a specific homeowner email
(typed in by the inspector when clicking "Invite Homeowner"). The redemption page
(`/invite/[token]`) looks up the invite via `/api/invite-info`, shows which property it's
for, and locks the email field — can't be mistyped. Enforced again server-side in
`/api/homeowner-signup` in case that endpoint is ever called directly.

## Done previous session — shadcn/ui + base homeowner system

**shadcn/ui rollout** — converted `EntryForm.js`, `PhotoUpload.js`, `InfoModal.js`,
`SiteNotes.js`, `ExportPanel.js` to shadcn primitives, matching `PropertySelector.js`.
Bespoke colored state UI (status pills, tab bar) left as custom-styled on purpose.

**Homeowner role base system** (from `wildfire-notes-ai-design-context.md`):
- `profiles` table (role + property_id) and `homeowner_invites` table —
  `supabase/migrations/001_homeowner_roles.sql` (already run).
- `role` lives in `profiles`, not `user_metadata` (which is client-editable —
  a homeowner could otherwise grant themselves employee access).
- Compliance status is stripped server-side in `/api/homeowner/entries` — never
  in the select, always null on insert. That route is the real security boundary.
- `SUPABASE_SERVICE_ROLE_KEY` is required in `.env.local` for all of this to work —
  already set and confirmed working.

## Not started yet (from the design doc, explicitly deferred)

- Deterministic compliance rules engine (JSON decision tree — doc only sketches
  fence + partial vegetation rules, rest not written)
- Report review/learning loop (docx re-upload, mammoth diff, `report_reviews` table)
- Pre-flight slope context (Google Elevation API) — satellite imagery pass is done,
  slope is not
- Charred Guard dev server port pin (currently unpinned, defaults to 3000)

Full design context: `wildfire-notes-ai-design-context.md` in this folder.

## Still awaiting your answer

- Should Fire Data (FHSZ lookup) and the old raw-notes/docx Export tab be folded into
  `/manage/[id]` as additional tabs? They're currently orphaned/unreachable since `/`
  now redirects employees straight to `/manage`. Flagged, not yet resolved.
- `charredguard.com` domain/ICANN-hold issue — paused per your instruction, not resumed.
