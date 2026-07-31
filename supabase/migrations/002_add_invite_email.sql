-- Adds an email lock to homeowner invites: the invite is generated for a
-- specific homeowner email, and redemption requires that exact email
-- (enforced server-side in /api/homeowner-signup, and the redemption page
-- locks the field so it can't be mistyped).

alter table homeowner_invites add column if not exists email text;
