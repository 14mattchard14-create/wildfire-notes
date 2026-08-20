# AI Differentiator — Implementation & Feedback UX

_Companion to `AI_DIFFERENTIATOR.md` (strategy) — this doc gets concrete about how each
differentiator actually gets built: what's prompted in the CG Inspector portal vs. what lives in
BOS, what tooltip copy explains to the inspector, and how the admin side monitors all of it.
Planning only, nothing built yet._

## Build priority note

Not all of this is near-term. **Mitigation cost estimation (#3) is explicitly deferred** — noted
inline below, not part of the initial build. Everything else can be sequenced independently;
picture analysis and satellite pre-flight are the most concrete and the best starting points.

## Design rule that applies to every inspector-facing item below

**Every confirm/correct/flag action must be skippable.** A visible "Skip" or "Not now" option
sits next to every AI check, always. Nothing blocks moving to the next photo or segment. Feedback
quality improves the tool over time, but it can never become a gate the inspector has to clear to
finish an inspection — that would wreck adoption immediately.

---

## 1. Picture analysis / gap detection

**CG Inspector sees/does:**
Photographs a segment as normal. Within a couple seconds, a compact AI check panel appears under
the thumbnail — one chip per rubric sub-question for that zone (green check / amber question
mark / gray N/A). Tapping an amber chip expands three options: **Confirm**, **Correct** (quick
field or photo retake), or **N/A**. A **Skip** option sits alongside every chip — leaves it
unresolved, moves on, no penalty. A separate, visually distinct **"+ Flag missing check"** button
lets the inspector note the rubric itself seems incomplete.

**Tooltip copy (example, shown on first use and via a small "?" icon thereafter):**
*"This confirms whether the AI correctly checked this item. Confirming or correcting it helps the
AI get more accurate for future inspections — your input is saved and reviewed, never sent
anywhere without review. Skipping is fine, no photo or check is required."*

**Skip behavior:** tapping Skip dismisses the chip for this session; the item is logged as
"unresolved," not as a wrong answer — no negative signal is recorded against the AI's guess.

**BOS shows/handles:** Report Quality / Insights gets a rollup per checklist item (see Dashboard
section below). Admin reviews any "flag missing check" submissions in a short queue and decides
whether to add a new rubric sub-question — this never auto-applies from the field.

---

## 2. Homeowner prompting calibration

**CG Inspector sees/does:** nothing during capture — this is a periodic quality check, not a
live loop. On the property review page, one optional question near the existing session notes:
*"Were the homeowner's prompts clear this session?"* Yes / No / skip, with an optional one-line
note if No.

**Tooltip copy:** *"This helps us tune how much detail the AI asks homeowners for — enough to be
useful, not so much they feel overwhelmed. Totally optional."*

**Skip behavior:** the question defaults to unanswered if ignored; saving the review doesn't
require touching it.

**BOS shows/handles:** nothing dashboard-worthy at low volume; folds into general report-quality
review. Revisit if this becomes a frequent pain point.

---

## 3. Mitigation cost estimation, calibrated against real job costs — DEFERRED

**Not part of the initial build.** Noted here for completeness since it's in the strategy doc,
but explicitly not being implemented in the near term. When it does get built: an "Actual" column
next to the existing `/estimate` tab's material/labor/total breakdown, filled in by whoever
closes out a completed job, fully skippable, with a variance indicator on the CRM job card. No
further design work needed until this gets picked back up.

---

## 4. Satellite/aerial pre-flight accuracy

**CG Inspector sees/does:** at inspection start, the existing satellite image shows AI-guessed
zone boundaries as dots. Tapping a dot confirms it (turns green); dragging or relabeling corrects
it. A **"Skip pre-flight review"** option at the top of the screen bypasses this entirely and
goes straight into normal capture — this step is explicitly optional, not a required gate before
starting.

**Tooltip copy (shown once, near the satellite image):**
*"These zone guesses come from satellite and street-view images, before anyone's on site.
Confirming or fixing them helps the AI scout properties more accurately next time. Skip this if
you'd rather just start the inspection."*

**Skip behavior:** unconfirmed dots are simply left as the AI's original guess — no penalty, no
follow-up prompt.

**BOS shows/handles:** pre-flight accuracy rollup in the dashboard (see below) — how often
guesses were confirmed vs. corrected, trending over time.

---

## 5. Final report quality, learned from A/B comparisons

**CG Inspector sees/does (only for Field Inspectors doing their own drafting):** when editing a
report section, an optional one-tap reason chip appears next to the edit — *"Wrong tone" /
"Missing detail" / "Factual error" / "Just my preference."* Skipping it just means the edit is
logged without a reason tag; nothing required.

**Tooltip copy:** *"Tagging why you changed this (optional) helps the AI match our report style
better over time. If you skip it, we still learn from the edit itself — just without knowing
why."*

**BOS shows/handles:** this is the more Admin/Partner-facing one — final review typically happens
there regardless of who drafted. Report Quality portal gets the edit-reason rollup (dashboard
section below).

---

## 6. Lead follow-up messaging, tuned per source/segment

**CG Inspector:** not involved — no field input.

**BOS shows/handles:** entirely inferred from existing CRM/booking outcome data (which template
was sent, whether the lead converted). Dashboard shows conversion rate by template/source over
time; no manual tagging required from anyone.

---

## 7. Report language → homeowner action

**CG Inspector:** not involved — no field input.

**BOS shows/handles:** inferred from whether a published report is followed by a booked
mitigation job (existing booking/payments data). Dashboard shows this correlation; purely
observational, nothing to build for input.

---

## 8. Hyper-local vegetation/risk knowledge

**CG Inspector sees/does:** nothing new — this rides on the vegetation photo capture already
built into every inspection. No dedicated feedback UI.

**BOS shows/handles:** long-horizon, low-frequency; not dashboard-worthy yet. Revisit once
there's a real fire-outcome data point to log against a past report.

---

## 9. CRM follow-up triage, receipt/invoice ingestion, inbox triage

**CG Inspector:** not involved — these are BOS-only, back-office pipelines (nightly digest,
receipt OCR review, draft email review). Kept out of the Inspector's mobile shell entirely;
different audience, different surface, no crossover.

---

## Admin BOS: AI Differentiator Dashboard

A new tab inside the existing **Insights** section (alongside Activity and Lessons Learned —
same information architecture, not a new top-level portal). Purpose: give Admin/Partner a single
place to see whether the feedback loops above are actually working, without digging through
individual properties.

**Proposed sections:**

- **Per-checklist-item accuracy** (picture analysis). For each rubric sub-question (vent mesh,
  distance estimate, slope grade, etc.): confirm rate, correction rate, skip rate, trending over
  the last 30/90 days. This is also the data source for the earlier decision rule — don't trust a
  checklist item unsupervised with homeowners until its correction rate stabilizes low across
  enough real inspections.
- **Rubric-gap review queue.** Every "+ Flag missing check" submission, sitting in one place for
  Admin to accept (turns into a new sub-question, versioned) or dismiss.
- **Pre-flight satellite accuracy.** Confirm vs. correct rate on AI-guessed zones, trending over
  time — a proxy for how much on-site time is being saved as this improves.
- **Report edit-reason breakdown.** Tone vs. missing detail vs. factual error vs. preference,
  from the report-drafting reason chips — shows whether AI drafts are getting closer to
  publishable as-is or still need heavy correction.
- **Skip rate, overall.** How often inspectors are skipping AI checks entirely. High skip rates
  are a signal worth investigating on their own — either the checks are annoying, badly timed, or
  not trusted yet, not just a data-volume problem.
- **(Deferred) Estimate variance.** Placeholder card, inactive until #3 gets built.

**What this deliberately doesn't include:** per-inspector leaderboards or individual accuracy
scores. Keep this centered on checklist items and system performance, not staff performance —
mixing those in risks turning a quality-improvement tool into something that feels like
surveillance, which would undercut the honest, low-friction feedback the whole system depends on.

---

## Overall UI recommendations for the CG Inspector portal

**One consistent visual language for AI checks.** Green check / amber question mark / gray N/A,
identical across photo gap-checks, satellite zone confirmation, and any future addition. One
pattern learned once, reused everywhere.

**Fast feedback stays inline, never a separate screen,** and **always has a visible Skip.**
Confirm/correct/skip happens where the inspector already is, one tap, instant visual
confirmation. Nothing here should ever require navigating away or filling a long form — the
design has to assume someone standing in a yard, phone in hand.

**Two distinct feedback weights, visually separated.** Fast per-item confirm/correct/skip (the
common case) must look different from the rare, deliberate "flag a missing rubric item" action,
which routes to human review rather than auto-applying.

**Tooltips explain "why," briefly, once.** Every feedback mechanism gets a short, plain-language
explanation of what's recorded and why — shown on first encounter, available afterward via a
small "?" icon, never a blocking modal. The goal is inspectors understanding their taps matter
and where the data goes, not a privacy-policy-style wall of text.

**A visible "this is going somewhere" signal.** A small, persistent counter on the Inspector's
own portal home ("12 checks logged today") — not buried in an Admin-only report.

**Backstops don't depend on the live loop.** Every fast-feedback mechanism has a fallback at
staff review time for anything skipped or left unresolved in the field.

**BOS is where the aggregate picture lives.** Individual inspectors see their own immediate
activity; Admin/Partner see the system-wide trend via the Insights dashboard above. Neither
surface needs to show the other's view — keep the split clean.

**Keep the mobile shell honest about who it's for.** Per `PORTALS_AND_ROLES_PLAN.md`, CG
Inspector is a stripped-down, mobile-first surface — taps and chips over free-text entry wherever
the underlying data allows it, reserving typing for the rare cases that genuinely need it.
