# Staging demo data, a README with links and accounts, and a sign-in panel that production hides

**Timestamp:** 2026-11-04T09:30+08:00 (SGT)
**Author:** Joash
**Scope:** `deploy/demo/seed-staging.mjs`, `README.md`, `frontend/src/screens/Login.tsx`, the browser-test stack's build flag.

## Added

- **`npm run demo:seed -- --env staging`.** Loads venues, equipment, events in every status, bookings,
  a hold, a block, change requests and registrations into staging through the application's own API.
  It refuses to run unless the Supabase project, the database login and the API host are staging's,
  and is safe to run again. Three extra attendee accounts are the only SQL (no API makes a user).
  An event already in a final state (cancelled, rejected, completed) is left where it is, so a
  second run doesn't try to approve a cancelled event. Run on staging on 4 Nov after the 9798a4f
  deploy: 16 events, 6 venues, 6 equipment types, 6 registrations (one a manual add), 1 waitlist entry.

## Changed

- **README.** Repository, staging and production links; running without the team's secrets; how deploys
  work; test accounts; where the test evidence is; the coverage numbers from the CI run on main.
- **Sign-in panel.** The seeded-accounts list, with `lead@` and `safety@` added, and the prefilled
  fields show only in development or when `VITE_SHOW_SEEDED_ACCOUNTS` is `true` (staging builds and
  the browser-test stack). Production shows a bare form.
