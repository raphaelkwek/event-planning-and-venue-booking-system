-- The name shown for a user wherever the app refers to a person — the submitting
-- organiser, the reviewing or assigned coordinator (B1, D1). Nullable: a user
-- without one is shown by their email instead.
alter table identity.users add column if not exists display_name text;
