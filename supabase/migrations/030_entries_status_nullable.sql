-- Bug fix: entries.status has a NOT NULL constraint from the original
-- (pre-migrations-folder) table definition, back when only staff created
-- entries and always set a compliance status inline. Homeowner-submitted
-- entries (app/api/homeowner/entries/route.js) intentionally insert
-- status: null — compliance status isn't determined until an
-- inspector/rules engine reviews the walkthrough later. That insert has
-- been failing in production with:
--   null value in column "status" of relation "entries" violates
--   not-null constraint
-- for every homeowner who submits an entry, discovered during live
-- end-to-end QA. Fix: drop the NOT NULL constraint so status can stay
-- null until it's set.

alter table entries alter column status drop not null;
