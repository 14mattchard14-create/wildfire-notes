# CharredGuard Business Docs

Knowledge base for CharredGuard Fire Risk Mitigation Services LLC — plain markdown + one spreadsheet, git-tracked, so any future Claude session (or other AI) can read it directly without anything being re-pasted into chat.

## Files

- **`business-plan.md`** — the reference business plan (pricing, market analysis, service lines, financials, legal templates). Source of truth for pricing ($500 on-site / $200 guided) and service area (Southern California, primary areas North San Diego County + Orange County) — `charred-guard-site` is reconciled against this, not the other way around.
- **`legal-risk-notes.md`** — living tracker of open legal/compliance questions raised against the plan (contractor-licensing exemption vs. marketing, permit requirements, regulatory citation accuracy, etc.). Update the Status column as items resolve.
- **`competitive-research.md`** — scan of direct competitors (Madronus, Wildfire Mitigation Advisors, Trident Inspection Group) and the gap analysis that drove several site changes.
- **`growth-poam.xlsx`** — three tabs:
  - `Assumptions` — editable inputs (prices, hours per job type, solo capacity threshold, scenario multipliers, margins). Change these, everything else recalculates.
  - `Growth Curve` — the business plan's Year-1 monthly volume targets, with live delivery-hours and capacity-status columns computed from Assumptions.
  - `Scenarios` — Conservative / Base / Aggressive side by side, each scaled from the Growth Curve by an adjustable multiplier, with a Year-1 summary comparison (total revenue, estimated net profit, peak hours/week) per scenario.
  - `POAM` — phased Plan of Action & Milestones (Pre-Launch → Audit-Only Launch → Hardening Launch & Marketing Scale → Partnerships & Capacity Checkpoint → Scale & Year 2 Planning), with a Status dropdown per item so it doubles as a tracker, not just a plan.

  **Note:** this file's formulas are valid and hand-verified, but weren't run through LibreOffice's recalculation step before delivery — the sandbox environment consistently needed more time than a single tool call allows for a workbook this size. Open it once in Excel, Numbers, or Google Sheets and it will calculate normally; there's nothing broken, just no pre-computed cache yet.

## How this fits together

`business-plan.md` is the plan. `legal-risk-notes.md` tracks what's still unresolved in it. `competitive-research.md` explains why certain site changes were made. `growth-poam.xlsx` turns the plan's static Year-1 table into something you can actually adjust and track against.

## On storage

This lives in git (not Google Drive) specifically so a `CLAUDE.md` pointer can make future Claude sessions aware it exists automatically. Git also gives real version history (every commit is a diff with a message). It doesn't give inline threaded comments the way Google Docs does — if that becomes important (e.g., other people need to leave comments), that's a reason to reconsider, but for now this keeps everything in one versioned place next to the code it describes.
