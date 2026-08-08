-- Anchors business_plan_comments to an exact selected phrase (like a Word
-- or Google Docs comment), instead of just the section it's in. `quote`
-- holds the plain rendered text the user selected when they left the
-- comment; the Plan page re-finds that text inside the section's current
-- rendered content to draw the highlight. Nullable and additive: existing
-- section-only comments (quote is null) keep working exactly as before,
-- just without a highlight to click on.
alter table business_plan_comments add column if not exists quote text;
