# AI Differentiator — Strategy Notes

_Planning doc, August 2026. Companion to `local-agent-ecosystem-options.md` (hardware/model
research) — this doc is the differentiation strategy: how a tailored AI system, built on top of
data CharredGuard already generates, becomes a competitive moat rather than just an efficiency
tool. Nothing here has been built yet._

## The core idea

Any competitor can call the Claude API. That's not a moat. The actual differentiation asset is
a system that gets progressively better at CharredGuard's specific judgment calls, cost
estimates, and communication style — calibrated against real outcomes from real inspections,
in a way no competitor can replicate without the same accumulated operational history.

## Two techniques, different jobs

| | RAG | LoRA |
|---|---|---|
| What it does | Retrieves similar past examples at the moment of a decision, injects them into the prompt | Trains small adapter weights on top of a base model so a behavior is baked in, not re-taught every call |
| Best for | Per-case judgment calls that benefit from "here's how similar cases were handled" | Consistent house style/behavior applied every time (report voice, terminology, systematic caution) |
| Data needed | Small — usefulness shows up around 20–50 corrected examples per specific judgment item | More — needs a real dataset to shift behavior reliably without overfitting |
| Update cycle | Instant — one new correction is usable immediately | Requires a training/eval cycle to retrain the adapter |
| Works with Claude API? | Yes | No — Claude API doesn't support customer fine-tuning; LoRA only applies to a local open-weight model |
| Auditability | High — you can see which examples were retrieved for any given decision | Lower — behavior is baked into weights, harder to inspect per-decision |

**Sequencing:** build the RAG correction loop first (it's what generates the labeled data in the
first place), let it mature, then convert well-established, repeatedly-taught patterns into a
LoRA adapter once there's a clear "this is just how we do it, every time" signal.

**Some things need neither.** Calibrating how much detail to give a homeowner (enough to act on,
not so much they're overwhelmed) is more a stable communication policy than a per-case retrieval
problem — likely solvable with careful prompt engineering and a fixed set of example exchanges,
without a full learning loop.

## LoRA portability — not locked into one model

- The LoRA **adapter** is tied to the exact base model it was trained against — it won't transfer
  to a different or newer model.
- The **training data** (labeled examples, corrections) is *not* model-specific — it's portable.
- Workflow: accumulate data continuously → retrain a fresh (cheap, fast) adapter against whichever
  base model is current whenever you upgrade hardware or a better open-weight model releases.
  No lock-in risk from committing to this approach now.

## Claude-generated training data → local LoRA (distillation)

A real, established technique: use Claude to bulk-generate high-quality labeled examples, validate
them against real staff corrections, then LoRA-tune the local model to approximate that judgment
quality. This is the path to eventually running near-Claude-quality judgment locally, for free,
without the ongoing per-call cost or connectivity dependency — but only makes sense **after** the
base feature and correction loop already exist, since that's what validates the Claude-generated
examples against ground truth rather than just baking in Claude's own mistakes.

_Checked against Anthropic's commercial terms: training is restricted only for building/training
competing AI models without express approval — not a blocker for a narrow internal tool. Confirmed
fine for this use case._

## Use cases identified

### From the original hardware/use-case research
1. **CRM follow-up triage** — reads `crm_followups`/booking data, produces a nightly prioritized
   digest. No new integration, data already local-only.
2. **Receipt/invoice ingestion** — watch-folder OCR extracting vendor/total/line-items into
   `mitigation_price_rates` review queue.
3. **Inbox triage + draft-only replies** — higher build cost (Gmail OAuth, draft injection),
   worth doing after #1–2 prove local quality is good enough.
4. **Personal finance/health correlation** — lowest leverage, "someday" tier.

### New — specifically differentiation-oriented (this thread)
5. **Final report quality, learned from A/B comparisons.** Already have the data source:
   `report_versions` (AI draft vs. what staff actually publish), Report Quality/Insights tooling.
   Leans LoRA once mature — this is a "consistent voice" problem, not a per-case retrieval one.
6. **Picture analysis / gap detection.** Given a photo, determine what wasn't captured and
   generate a specific homeowner follow-up question. See "Picture analysis — detailed plan" below.
7. **Homeowner prompting calibration.** Right level of detail in follow-up questions — probably
   prompt engineering, not RAG/LoRA.
8. **Mitigation cost estimation, calibrated against real job costs.** Compare AI-estimated cost
   vs. actual final cost (from the payments/ledger system) per job — a clean, quantifiable
   calibration signal, same shape as the distance-estimate idea below.
9. **Satellite/aerial pre-flight accuracy.** Improve pre-flight zone/vegetation/material detection
   against what inspectors actually find on site — reduces on-site time, feeds directly into the
   existing per-person capacity model in the Forecast tool.
10. **Report language → homeowner action.** Track which finding phrasing/framing actually gets
    homeowners to approve mitigation work, not just which reports are accurate.
11. **Lead follow-up messaging, tuned per source/segment.** Same idea as marketing response-curve
    work already built, applied to individual CRM follow-up templates instead of aggregate spend.
12. **Hyper-local vegetation/risk knowledge.** Build a service-area-specific picture of which
    species/conditions actually correlate with real findings — the slowest to mature, hardest for
    a competitor to replicate, since it's literally built from accumulated fieldwork.

Common thread across 5–12: all are "does the AI's prediction match what actually happened" loops
using data already generated by running the business — not new instrumentation projects.

## Picture analysis — detailed plan

Because this was the most deeply scoped use case, the specifics:

- **Checklist/rubric per zone**, decomposed into atomic sub-questions (e.g., for "defensible
  space adequate": ground cover material, distance-to-vegetation estimate, slope grade,
  combustible structures in zone). Rubric is staff-authored and versioned — a human-owned,
  auditable artifact, not something inferred purely from corrections, given the compliance/
  liability weight of this specific judgment.
- **Two refinement loops, different cadence:**
  - *Calibration loop* (fast, automatic): per sub-question, log AI answer vs. staff correction
    (including real measured distances vs. AI estimates — a clean quantifiable metric). Feeds
    the RAG retrieval layer.
  - *Rubric loop* (slow, human-curated): when staff notice a structurally missing sub-question,
    add it deliberately — reviewed, not auto-applied.
- **Staged rollout:** run in-person first (staff present, live structured feedback — richer
  signal than review-time correction since staff can resolve ambiguity a photo alone can't),
  build confidence per checklist item (~30–50+ real inspections tracking false-positive/negative
  rates), *then* trust it in the no-review homeowner self-serve flow. Flip per checklist item as
  it earns it, not all-or-nothing.
- **Risk reframing:** the existing draft/review/publish step before a report reaches the customer
  remains a backstop regardless — the real exposure of homeowner-unsupervised capture isn't a bad
  report reaching the customer, it's a worse homeowner *experience* (unclear/excessive prompting).

## Local vs. Claude API — the honest comparison for this feature

Ran the numbers specifically for photo gap-detection:

- **Local (7B vision model, Studio-tier hardware):** ~5–15 seconds per photo (directional
  estimate, not benchmarked), cumulative to a couple minutes across a 15–20 photo inspection.
- **Claude API (Haiku 4.5):** ~1,300–1,500 visual tokens per typical inspection photo, ~$0.003–
  0.004/photo. At 20 photos × 50 inspections/month, ~$3–4/month. Even at 200 inspections/month,
  under $15/month. Sonnet 5 (better judgment quality) runs ~3x that, still single-digit-to-low-
  double-digit dollars/month.
- **Conclusion:** Claude wins on cost (already trivial either way), speed (dedicated inference
  infrastructure, no local OS/app contention), and quality (judgment-heavy tasks are exactly
  where a 7B local model is weakest). For this specific feature, there's little standalone case
  for local — **unless** paired with the Claude→LoRA distillation plan above, which is the actual
  path to eventually matching that quality locally.

## Hybrid architecture: local-first, Claude for overflow

- Given concurrent homeowner sessions are rare (almost always one property at a time), route
  overflow sessions to Claude rather than provisioning local hardware for a peak load that's
  essentially never hit. Clean, bounded pattern — doesn't touch the high-stakes common case.
- **Rejected:** confidence-based escalation ("local tries first, hands off to Claude when
  unsure"). Small models tend to be confidently wrong rather than accurately self-aware of their
  own uncertainty — the exact failure mode that would make this escalation trigger unreliably.
  Not pursuing unless/until local confidence scores are validated against real outcomes.

## Data privacy / training

- **Claude API (developer/commercial):** by default, not used for model training; Anthropic is
  contractually restricted from training on customer content without express permission. Standard
  behavior, no special setup needed for this protection.
- **Zero Data Retention (ZDR):** available but requires an approved sales arrangement — likely
  more friction than warranted for occasional overflow-only usage; not pursued for now.
- **Consumer Claude accounts (claude.ai):** as of Aug 2025 policy change, train on conversations
  by default unless opted out via Settings → Privacy → "Help improve Claude" toggle. **Toggled
  off** for this account during this research thread.
- **Escalation-to-Claude for photo overflow** does mean property photos leave the local machine
  for those specific cases — a real, if lower-stakes, version of the data-locality trade-off
  already accepted for CRM/financial data staying strictly local.

## Suggested sequencing

1. Validate model quality on the cheapest possible test (CRM triage on current hardware) before
   buying anything — per the original hardware doc's suggested next step.
2. Build audit logging into every pipeline from line one — it's the same mechanism that later
   feeds the RAG correction loop, not a separate project.
3. Pick one differentiation use case to scope first — final report A/B learning is the strongest
   candidate, since the training signal (`report_versions`) already exists as a byproduct of
   current operations.
4. Build picture analysis via Claude API directly (skip local vision model for now) — get the
   feature live and start accumulating staff corrections during in-person inspections.
5. Only after correction data accumulates in volume: evaluate Claude→LoRA distillation for
   whichever features would benefit from moving off the API long-term.

## Open questions

- Confirmed discounted price for the 36GB Mac Studio config (only the 48GB mini and 64GB Studio
  have been priced against the friend discount so far).
- Whether the picture-analysis feature ever needs true local-only operation (e.g., poor
  connectivity in the field) — would change the local-vs-Claude calculus back toward local.
- At what accumulated correction volume the LoRA distillation project becomes worth the
  engineering investment, versus continuing to run RAG + Claude indefinitely.
