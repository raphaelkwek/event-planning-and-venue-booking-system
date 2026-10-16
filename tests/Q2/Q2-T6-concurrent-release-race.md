# Q2-T6 — Simultaneous releases of one reservation: exactly one succeeds

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T6 |
| Test Scenario | Release is atomic: concurrent releases of the same reservation release it once and write one timestamp and one history entry |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q2/README.md` (CI runner only). Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q2 from `tests/Q2/README.md` supplies the actors and the window `D 14:00`–`D 18:00` UTC; the race creates its own types, events and lines.<br>3. A Reserved bulk line on CI's throwaway Postgres. This card runs only there, never the shared database; the race tests skip themselves elsewhere. |
| Test Steps | 1. Call `releaseLine` fifty times simultaneously for the line; repeat for ten rounds, reserving a fresh line each round.<br>2. Count the outcomes and read the reservation, the line and its history after each round.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/race/invariants.test.ts -t 'Q2-T6 '` on CI's throwaway Postgres and read the named `Q2-T6 ` result. |
| Test Data | Fifty simultaneous `releaseLine` calls, ten rounds |
| Expected Result | In every round exactly one call succeeds. The others fail with `LINE_NOT_RELEASABLE` (status CONFIRMED). The reservation has one `released_at`, and the line has exactly one history entry with `details.released` true. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-16 |

> **Expected results are checked by the PR reviewer** against Q2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks |  |
| Executed By | |
| Date of Execution | |
