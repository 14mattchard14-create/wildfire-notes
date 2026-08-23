@AGENTS.md

# Business context

The `/business` folder in this repo holds CharredGuard's business plan, legal/compliance risk notes, competitive research, and the Year-1 growth POAM + financial scenario model. Read `business/README.md` first if a task touches pricing, geography, legal/licensing questions, marketing strategy, or financial projections — don't assume any of that from `charred-guard-site`'s copy alone, since the business plan is the source of truth and the site is reconciled against it.

# Stack

- Next.js 16.2.9 (App Router, `app/` directory), React 19.2.4 — a very new Next.js version; see the note in AGENTS.md about reading `node_modules/next/dist/docs/` before assuming API behavior from training data.
- Tailwind CSS 4, Radix UI primitives, `class-variance-authority` for variant styling, `lucide-react` icons.
- Supabase (`@supabase/supabase-js`) for auth/database — client in `lib/supabase.js`, migrations in `supabase/migrations/` (30 sequential SQL files as of writing).
- `docx` for generating Word report exports, `marked` for markdown rendering, `@anthropic-ai/sdk` as a dependency (check `lib/` and `app/api/` for current usage).
- Deployed on Vercel — see `vercel.json` (daily cron hitting `/api/cron/report-reminders` at 15:00 UTC).

# Commands

- `npm run dev` — dev server on **port 3010** (not the Next.js default 3000)
- `npm run build` / `npm run start`
- `npm run lint` — ESLint (flat config in `eslint.config.mjs`)

# Structure

- `app/` — App Router pages and API routes. Route groups include `crm`, `manage`, `inspector`, `business`, `insights`, `report`, `estimate`, `documentation`, `invite`, `users`, `quality`, `login`, `reset-password`.
- `app/api/` — large surface: booking/payments, CRM (discounts, followups, payments, templates), report generation/versioning/publishing (incl. docx export), homeowner invite/signup flows, satellite/fire-history/fhsz lookups, Cal.com webhooks, cron jobs.
- `components/` — shared React components; `components/ui/` has the Radix-based primitives (button, card, input, label, select, textarea).
- `lib/` — server/auth helpers, Supabase client, email, Google Calendar, criteria/report schema logic.
- `supabase/migrations/` — sequential SQL migrations; booking/payments landed in `015_booking_payments.sql`.

# Planning docs (check before large features)

This repo carries its own planning/spec docs at the root — read these before assuming scope from scratch:

- `BOOKING_PAYMENTS_PLAN.md`, `PORTALS_AND_ROLES_PLAN.md`
- `AI_DIFFERENTIATOR.md` / `AI_DIFFERENTIATOR_IMPLEMENTATION.md`
- `wildfire-notes-ai-design-context.md`
- `NEXT_STEPS.md` is a large (~110KB) running log/plan file — grep for a keyword rather than loading it whole.

# Related repo

`charredguard-site` (sibling repo, same company, at `../charredguard-site`) is the public marketing site. It's a separate Next.js app; its visual identity (colors/fonts) is intentionally kept in sync with this app's day theme.
