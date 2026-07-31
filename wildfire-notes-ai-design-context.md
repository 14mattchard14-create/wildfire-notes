# Wildfire Field Notes App — AI Feature Design Context

This document captures a full design conversation about extending the
inspector app with self-service homeowner capture and an AI-assisted
report pipeline. Nothing here is built yet — this is the agreed
architecture to implement.

## Base app context

See the app's own README/existing docs for the current implementation
(Next.js 16.2.10, Supabase, Claude Sonnet for report generation, existing
tables: properties, entries, site_notes, shared_reports). This document
covers the NEW design layered on top of that.

## Two user roles (new)

1. **Employee login** — same as current state. Enters/reviews compliance
   findings, edits the generated Word doc before sending.
2. **Homeowner login** — new, self-documentation only. IMPORTANT: the
   homeowner must never be asked about compliance, and must never be shown
   compliance status at entry time. Compliance evaluation must run
   server-side, somewhere the homeowner-role UI genuinely cannot see it
   (not computed client-side and hidden with CSS — inspectable via dev
   tools). Homeowner-facing views only ever receive raw facts they
   entered, never derived status.

## Guided capture flow — location-first, not category-first

Homeowners can have different findings around different sides of the
house for the same WPH category (e.g., trash can on one side, plants on
another, gravel on a third). Organizing capture by WPH category would
require walking the whole perimeter once per category — bad UX.

**Solution:** organize the walkthrough by physical segment (Front → Left
Side → Back → Right Side → Detached Structures/Yard → Roof/Gutters →
Overall Site), matching how a person actually walks a property once.
Within each segment, prompt through whichever categories are physically
relevant there. Multiple entries can share the same category tag across
different segments — this already fits the existing `entries` table
(multiple rows per zone).

Full compliance synthesis per category happens once, at report-generation
time, after the full walkthrough — already how `report-docx/route.js`
works today (groups entries by zone, synthesizes one finding per
category).

## Compliance determination — deterministic rules tree, NOT live AI judgment

Core decision: compliance status should come from a rules engine encoded
directly from the WPH checklist (branching/conditional logic like
Typeform's logic jumps), not from an AI reasoning fresh each time.

**Why:** compliance calls are the actual product being sold. A static
tree applies the same rule identically every time, is fully auditable,
and updates instantly when WPH criteria changes (edit JSON, done). An AI
reasoning live risks drift/inconsistency across inspections — a real
liability for a certification-adjacent business.

**Example (fence):**
```
Fence present within 30ft? → Yes/No
  → Yes → Measure distance from foundation
      → Under 5ft → Material? [Metal / Concrete / Wood / Vinyl / Composite]
                       Metal, Concrete → COMPLIANT (Base)
                       Wood, Vinyl, Composite → NON-COMPLIANT
      → 5–30ft → different rule (spacing/hedging) applies
```

Materials are finite/known lists — homeowner self-reports via dropdown,
no AI needed for the normal case. AI's only role: an opt-in "not sure —
let AI guess from the photo" fallback, single on-demand vision call, used
rarely.

**Build approach decided:** roll-your-own (JSON schema + React wizard),
not a survey library like SurveyJS — because nearly every question here
needs a custom renderer (camera capture bound to a question, measurement
input) that a generic survey engine doesn't provide natively anyway, so
the library's main selling point (branching logic) isn't worth the
dependency.

**Side effect:** structured Q&A pairs instead of freeform notes also
improves report-generation quality — Claude gets clean facts instead of
shorthand to interpret.

## AI's actual roles (all narrow, all cheap)

1. **Turning structured facts into report prose** — existing
   report-generation call, now fed cleaner structured input.
2. **Novelty-flagging at zone transitions** — after a segment's photos are
   captured, one Haiku call per segment (not per photo) asks "anything
   unusual here the standard question set doesn't cover?" If yes, injects
   an extra targeted question into that segment (reusing existing rule
   logic, e.g. tree-spacing) rather than becoming a finding on its own.
   Once the homeowner answers with a real measurement/photo, that
   confirmed answer fully replaces the tentative flag — never show both
   side by side in the report.
3. **"Not sure" material-identification fallback** — opt-in, single-photo,
   rare.
4. **Pre-flight property context** (new, before walkthrough starts):
   - FHSZ zone + fire history (already integrated: `/api/fhsz`,
     `/api/fire-history`)
   - Slope via Google Elevation API (new)
   - One Haiku vision pass over a Google Static Maps satellite image of
     the address (~$0.002/image at $2/1000 Static Maps requests) —
     flags large visible features (tree canopy, pool, shed) as candidate
     items, tentative only
   - Satellite/aerial imagery is explicitly NOT evidence — it's stale
     (months/years old) and low-resolution for material ID. Only used to
     (a) inject extra targeted questions into the relevant segment
     (resolved into confirmed ground truth), or (b) calibrate emphasis in
     the final report narrative (e.g., high slope → weight defensible-
     space recommendations higher), never as a standalone finding.

## Three-tier confidence model (for narrative-only sections like "Overall Site")

Not every category is a threshold lookup — "Overall Site & Surrounding
Environment" is inherently descriptive/synthesized, not deterministic.
Feed Claude three distinct input tiers, hedge them differently in the
prompt:
1. **Official/objective** (FHSZ, fire history, slope) — state as fact.
2. **Tentative** (satellite AI observations) — must be hedged
   ("aerial imagery suggests..."), never stated as confirmed.
3. **Confirmed** (on-the-ground homeowner/inspector entries) — state as
   fact.

## AI cost reality (computed, current as of July 2026 pricing)

- Claude vision: tokens ≈ (width × height)/750. Resized phone photo
  (~1568px long edge) ≈ 1600 tokens.
- Haiku 4.5: $1/$5 per MTok. Sonnet 5: $2/$10 intro (through Aug 31 2026)
  then $3/$15 standard.
- Novelty-check call (image + criteria text + short output) on Haiku:
  ~$0.003/call. At ~8–10 zone checkpoints per inspection: ~$0.03/full
  inspection. Even worst-case (every photo, not batched): ~$0.09–0.18.
- Google Static Maps: $2/1000 requests = $0.002/property.
- **Conclusion: cost was never the real constraint at this volume.** The
  real considerations are latency (batch at zone transitions, not per
  photo), reliability/consistency (keep compliance logic deterministic),
  and false-positive/negative tuning (needs a real eval set before
  launch).

## Report versions and the human-review learning loop

**Two AI report outputs (employee-facing):**
1. "Onsite" draft — rough, terse, field-notes voice, generated
   immediately after the walkthrough, deliberately looks
   inspector-written rather than AI-polished.
2. Full detailed report — same as current report-generation flow,
   markdown → docx via existing client-side `docx` build.

**Review/edit/learning pipeline:**
1. Employee edits the actual .docx (in Word, outside the app).
2. Re-uploads the edited .docx back into the app.
3. `mammoth` (already available in the stack) extracts clean text from
   the edited docx.
4. That extracted text is diffed against the original AI-generated
   markdown.
5. Store all three: `ai_draft`, `final_edited_text`, `diff` — new table/
   fields needed (e.g. `report_reviews`), doesn't exist yet.
6. **Final customer-facing version regenerates from `final_edited_text`**,
   not the AI original — reuses the EXISTING shareable web report system
   at `/report/[token]` (decided: don't build a separate polished
   template, reuse what's already built).
7. Periodic (not real-time) review of accumulated diffs, sorted into two
   buckets:
   - **Bucket A — fact/compliance corrections** (e.g. inspector changed
     Compliant → Non-Compliant): signal that the RULES TREE has a gap,
     fix goes into the schema, not the AI prompt.
   - **Bucket B — tone/phrasing corrections**: legitimate prompt-
     improvement material. Periodically curate the clearest examples into
     few-shot examples added to the report-generation prompt (with prompt
     caching, since the WPH criteria text is static/reused).
   - Do NOT auto-feed every edit back in real time — keep a human curating
     what actually goes into the prompt, to avoid baking in one person's
     idiosyncratic phrasing or an inspector's own mistake becoming
     "canon."

## Explicitly decided against (with reasoning, in case revisited)

- **RAG / vector DB**: not needed. WPH checklist is small enough (~10-15
  pages) to include directly in prompt + cache. Revisit only if a
  natural-language "ask about any rule" chatbot feature gets added later
  with a much larger/multi-jurisdiction reference corpus.
- **Fine-tuning**: (a) not really available — Anthropic doesn't offer
  self-serve fine-tuning through the standard API, only limited
  enterprise/Bedrock paths; (b) wrong tool anyway — hard compliance rules
  belong in auditable code, not model weights that can't be instantly
  corrected or fully explained.
- **Pure AI-driven live question generation** (AI decides next question
  on the fly from each photo, no pre-built tree): rejected — cost scales
  with conversation turns not just photos, adds per-step latency, and
  most importantly risks inconsistent compliance determinations across
  inspections, which is a real liability for this business specifically.

## Open items / not yet decided

- Exact new DB schema for structured Q&A responses (replacing/extending
  freeform `entries` notes) — not designed yet, next concrete step.
- Exact new DB schema for `report_reviews` (ai_draft/final/diff capture).
- Full WPH decision tree only sketched for fence + partially for
  vegetation zone — not written out for all categories yet.
- Onsite-draft prompt not yet written.
- Novelty-flag prompt not yet written.
