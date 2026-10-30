# EN-13 — Registration service and seat inventory

EN-13 is an enabler, so it has no user-facing screens. Its cards check the seat inventory that R2 to R7
build on. Each runs as a vitest command against a database with the `registration` schema; the unit
paths need none.

| Area | Card | Latest result |
|---|---|---|
| Seats built from an approval | EN-13-T1, T4, T5, T6, T7 | Pass |
| The claim and the pools | EN-13-T2, T3 | Pass |
| Invalid and unrelated messages | EN-13-T8 | Pass |
| Race: 500 attendees, 100 seats | EN-13-T9 | Pass, and fails without `skip locked` |

**Not covered, on purpose.**
- **The attendee PWA shell** (Jira's fourth criterion) ships in its own pull request.
- **R2 to R7's routes, the registration outbox and the waitlist** arrive with those stories.
- **Seats shrinking when a venue's capacity falls** goes through ADR-0009's workflow.
- **Shared database:** the migration was applied to the team's Supabase project on 30 Oct 2026, and the
  registration tests pass there too (38 tests, no rows left). The other runs used a throwaway
  Postgres, and CI uses the runner's.
