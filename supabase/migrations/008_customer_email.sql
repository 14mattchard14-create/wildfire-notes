-- Customer contact email, independent of the homeowner self-service invite
-- flow. Report delivery previously only worked when a homeowner had been
-- invited and signed up — this lets any property have a customer email on
-- file regardless of whether the inspection was done by the homeowner or
-- entirely by the inspector in person.
alter table properties
  add column if not exists customer_email text;
