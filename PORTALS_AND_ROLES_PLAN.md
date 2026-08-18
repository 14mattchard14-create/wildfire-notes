# Portal split + permission roles: planning doc

_Status: planning only — not being built yet. Capturing the decisions and open questions so
this doesn't need to be re-derived later. Separate from NEXT_STEPS.md (the build changelog),
same pattern as BOOKING_PAYMENTS_PLAN.md._

## Why this exists

The admin side (`/manage`) is desktop-oriented — CRM, forecast, business plan, insights,
property review/editing/publish. On-site capture (`GuidedEntry` — satellite image, per-segment
photos, measurements) is currently embedded *inside* that same admin shell (`AdminSidebar` +
`BackNav` + full page chrome), even though it's fundamentally a "standing in a yard, phone in
hand" task, not a desk task. It works on mobile but poorly.

Decision: split it, the same way homeowners are already split out (`HomeownerHome` — no admin
chrome, minimal UI, mobile-first). Staff doing field capture should get an equivalent
lightweight surface, separate from the dense desktop dashboard.

## Portal naming — decided

- **Home Owner** — the self-guided customer capture experience. Not CG-branded (it's what the
  customer sees/uses, not an internal CharredGuard tool). Currently `HomeownerHome` — keeps its
  existing behavior/route, this is a formal naming, not a rebuild.
- **CG Inspector** — the new mobile-first, staff-only field capture portal. This is the thing
  being split out of the admin shell. Planned route: `/inspector/[id]`. Reuses `GuidedEntry`'s
  actual logic (satellite image, segments, photos, measurements), just rendered without
  `AdminSidebar`/`BackNav` — a stripped-down, mobile-first shell built for standing at a
  property with a phone.
- **CG Business Operations Software** — shortened to **BOS** in everyday use. The desktop
  admin dashboard: CRM, forecast, business plan, insights, property review/editing, publish,
  settings. This is today's `/manage`, just formally named.
- **Charred Guard Report** (**CG Report** for short) — the published customer-facing
  deliverable. Currently `/report/[token]`, keeps its existing behavior/route — formal naming
  only, not a rebuild.

All four portal names are now decided:

| Name | Short form | Audience | Route |
|---|---|---|---|
| Home Owner | — | Customer (self-guided capture) | `/` (existing, role-gated) |
| CG Inspector | — | Staff (field capture) | `/inspector/[id]` (new, not yet built) |
| CG Business Operations Software | BOS | Staff (admin/back-office) | `/manage` (existing) |
| Charred Guard Report | CG Report | Customer (finished deliverable) | `/report/[token]` (existing) |

## Roles — not yet decided, but plan for it

**Current state:** the system has exactly two roles today, hard-coded in the DB check
constraint: `role in ('employee', 'homeowner')`. Every API route just checks "is this an
employee, yes/no" — there's no tiering. Every current staff login has full access to
everything. This is a real gap to design around, not a small tweak — it touches the `profiles`
role column, roughly 30 API routes that currently do that binary check, and the admin nav
(hide sections a role can't reach).

**Target roles — decided:**

- **Admin** (Matt) — everything. User/role management, Documentation tab, business plan
  (direct edit), forecast, CRM, insights, all properties (capture/review/publish, full list in
  BOS), settings. One of two roles that can do final publish/send-to-customer.
- **Partner** (business partner) — broad visibility, gated write access on sensitive actions.
  Sees the full property list in BOS (same as Admin) and CRM. Can edit the business plan, but
  an edit doesn't go live directly — it saves as a pending version and goes to Admin for
  review before being applied. Cannot delete reports directly — has to submit a delete request
  that Admin approves. **No access to user/role management or the Documentation tab.** The
  general pattern: Partner can see and propose broadly, but anything destructive or
  irreversible routes through an Admin-approval step rather than being a flat allow/deny. This
  same "request → Admin approves" shape should be the default for other high-stakes Partner
  actions as they come up, not just these two examples. Also one of two roles that can do final
  publish/send-to-customer (alongside Admin).
- **Field Inspector** — not a fixed person; whoever's assigned to a given inquiry (could be
  Admin, Partner, or a dedicated hire). "Assigned inspector" is a per-property attribute, not
  tied to a person's overall role — when a new inquiry comes in, an inspector gets assigned to
  it. CG Inspector (the mobile capture portal) only ever shows the properties assigned to
  whoever's currently logged in, regardless of their overall role. A dedicated Field Inspector
  hire (someone whose *only* role is Field Inspector) also gets a limited slice of BOS: the
  property review/editing screen, scoped only to their own assigned properties — they own the
  process end-to-end (capture → draft → edit) but **cannot publish**. Final publish/send-to-
  customer always requires Admin or Partner review first. No CRM, no business plan/forecast, no
  Documentation tab, no user management, no other properties. Can request access to additional
  properties, which Admin approves (same request-based pattern as Partner's gated actions).
- **Manager/Dev** — full edit access to business plan/forecast (same as Admin). Presumed same
  restriction as Partner on user/role management and Documentation (not explicitly revisited,
  carried over from the original draft — confirm if this changes). Infrastructure-level access
  (GitHub, Vercel, Supabase dashboard, env vars/secrets) is a separate, deferred question — see
  below.

**Resolved questions (from the original open list):**

1. **Partner scope** — full property list + CRM visibility, business plan edit via
   Admin-reviewed pending version, no direct report delete (request-based), no user
   management, no Documentation tab.
2. **Manager/Dev + financials** — full edit access, same as Admin.
3. **CG Inspector property scoping** — "assigned inspector" is a per-property attribute any
   user can hold, not a fixed role. CG Inspector always filters to "my assigned properties."
   Admin and Partner see the unfiltered full list in BOS.
4. **Cross-visibility for multiple inspectors** — siloed by default; an inspector can request
   to see more properties, Admin approves.
5. **Publish authority** — Field Inspector owns capture through drafting/editing for their own
   properties (a limited, siloed slice of BOS, not just CG Inspector), but cannot publish.
6. **Post-submission visibility** — superseded by #5: Field Inspector isn't just submitting and
   walking away, they're doing the drafting/editing themselves, so they inherently see the
   draft/review state for their own properties. Final publish still requires Admin or Partner.
7. **Who can create a property / generate an invite** — Admin and Manager.
8. **Migration of existing accounts** — explicit reassignment, not a bulk default-to-Admin. Matt
   will provide database access so current users can be seen and reassignment questions can be
   asked per-person once the schema/UI exists (the new Users & Roles tab, once built, can be
   used directly to do this reassignment rather than hand-editing Supabase).
9. **Manager/Dev infra access + security** — deferred. Matt wants to understand the security
   tradeoffs first, and this is tied to setting up a dedicated CI/CD pipeline, which hasn't
   happened yet. Revisit when that work starts.
10. **Build a real Users & Roles UI now** — yes. New admin-only tab in the BOS sidebar.

**Also decided (this round): a Documentation tab**, admin-only sidebar tab in BOS, for storing
planning docs like this one (and others — BOOKING_PAYMENTS_PLAN.md, NEXT_STEPS.md, etc.) inside
the app itself rather than only as repo files. Admin-only visibility for now.

**Implementation shape:** expand the `profiles.role` check constraint beyond the current binary
(`employee`/`homeowner`) to `admin`, `partner`, `field_inspector`, `manager`, `homeowner`. Add
an `assigned_inspector_id` (or similar) concept to `properties` for the CG Inspector filtering.
Existing `employee` accounts get explicitly reassigned via the new Users & Roles tab once it
exists, not auto-defaulted. Building now: the Users & Roles tab and the Documentation tab (both
admin-only). Not building yet: the CG Inspector portal itself, the pending-version approval
workflow for Partner's business plan edits, the report-delete-request flow, and per-route
permission gating across the ~30 existing API routes — those follow once the underlying role
schema exists.

## Next steps

1. ~~Pick the portal naming pair.~~ Done.
2. ~~Answer the open role questions.~~ Done.
3. ~~Build now: role schema migration, Users & Roles tab (admin-only), Documentation tab
   (admin-only).~~ Done — see `NEXT_STEPS.md` (2026-08-18 round) for exactly what shipped.
   Run `supabase/migrations/029_roles_and_documents.sql`, then reassign your own account to
   `admin` from `/users` — nothing was auto-migrated.
4. Later: CG Inspector portal split, per-route permission enforcement, Partner's business-plan
   approval workflow, report-delete-request flow, property-access-request flow, Manager/Dev
   infra access (tied to future CI/CD setup).
