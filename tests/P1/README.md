# P1 — Availability verification

P1 uses **peak concurrent use** following the user's 8 October 2026 CQ-02 answer, recorded in `documentation/clarifications.md`. Bulk reservation and maintenance quantities share one timeline. Serialized units must be free for the entire requested window and a reserved/unavailable unit is excluded once.

Independent acceptance tests were specified before the cards from P1's acceptance criteria. A separate agent reviewed the scenario expectations against those criteria. Human story-owner review remains pending; no §11.12 confirmation or waiver is claimed. `backend/services/planning-core/tests/equipment/api/p1Cards.test.ts` exercises the real Express API and migrated Postgres with authentication stubbed. Its fixture owns only actor `ae111111-0000-0000-0000-000000000001`; setup and cleanup are scoped to that actor. It does not depend on P2 routes, migrations, or inventory history.

## Isolated automated setup

Use CI's `Integration tests (throwaway Postgres)` job: `.github/workflows/ci.yml` creates a disposable Postgres 17 container, checks DATABASE_URL is the runner, applies every migration and runs planning-core tests. To reproduce locally, use a throwaway local Postgres database and set DATABASE_URL explicitly to it, along with the CI placeholder Supabase variables. Run `npm ci`, `npm run migrate:all`, then `npm test -w @connectsphere/planning-core -- tests/equipment/api/p1Cards.test.ts`. Never use the shared Supabase database for the automated suite.

Each card T1–T13 and T15–T16 is a fully specified **API/database procedure** with stubbed authentication declared in its preconditions; its Pass applies to that scope. They do not claim browser clicks or actual sign-in. T14 is a separate browser procedure and stays Not Executed until every step is run.

## Acceptance coverage

| Cards | Acceptance behavior |
|---|---|
| T1–T4 | Numeric quantities; peak rather than summed overlaps; simultaneous and separated maintenance |
| T5–T6 | Half-open periods; touching excluded; partial overlaps included |
| T7–T9 | Requested quantity below, at, and above available; exact shortfall |
| T10 | Serialized unit unavailable and reserved counted once; never available |
| T11 | Released and removed records excluded |
| T12 | Repeated checks create no reservation and modify no stored equipment row |
| T13 | Zero inventory boundary |
| T14 | Real signed-in browser display and repeated check workflow |
| T15 | Malformed periods and negative/fractional request quantities refused with named fields |
| T16 | Other active roles refused without modifying stock |

## Evidence and execution

Record the exact tested commit using `git rev-parse HEAD`, command, date, complete captured output and source CI link in `tests/P1/evidence/`. Name evidence `P1-T<n>-YYYY-MM-DD.txt` (or screenshot `.png` for browser results). A shared CI transcript is valid if card Remarks links the transcript and identifies the named test. Record a Pass only after the selected test was actually run and its stated assertions passed. An unavailable environment is Blocked; planned browser runs are Not Executed. Replace each execution record on rerun.

API suite implementation assertions cover full response quantities and UTC time normalization; T12 compares complete rows of all five equipment tables, including timestamps and actors. Additional route validation, authentication, permission and frontend tests are reported separately in PR evidence.

## Browser fixture

Use a throwaway database for the local app and the standard account setup from `tests/README.md`, with `npm run migrate -- equipment` included. Set the browser timezone to Asia/Singapore. Run `tests/P1/fixtures/ui-availability.sql` immediately before T14. It creates a named bulk type with total 10 and reservations 4 at 10:00–12:00 UTC and 5 at 12:00–14:00 UTC. Rerunning removes only this fixture's exact rows. Do not run it in the shared team database.

## Verified run — 2026-10-08 (Asia/Singapore)

Tested commit: `a00b6bf3e17ddcd4db343e9e15e5495f61ac6c57`. [CI run 37665394086](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/37665394086) and CodeQL passed. The [complete planning-core test output](evidence/P1-CI-2026-10-08.txt) records all fifteen named API cards passing within 585 tests; additional availability API tests also passed. Integration coverage: 94.77% lines/statements, 90.31% branches, 94.76% functions. Unit job: 319 backend and 62 frontend tests passed, including 19 P1 UI checks. Changed-domain mutation score: 95.51%, above the 80% floor.

T1–T13, T15 and T16 are Pass for their stated real API/Postgres procedures with authentication stubbed. T14 remains Not Executed; frontend automation does not establish actual sign-in/browser completion. Human story-owner review remains pending.
