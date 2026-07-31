# Status — wildfire-notes

_Last updated: 2026-07-30_

## ⚠️ Action required — new migration

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
