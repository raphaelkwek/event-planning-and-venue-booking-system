# Q1-T13 — Two simultaneous reservations for the last unit: exactly one succeeds

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T13 |
| Test Scenario | Reservation is atomic with the availability check, for bulk and serialized equipment |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md` (CI runner only). Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` supplies the actors and the window `D 14:00`–`D 18:00` UTC; the race creates its own types, events and lines.<br>3. A bulk equipment type with total 1 and a serialized type with one unit; for each, fifty Confirmed lines of quantity 1 on different events, all for the same window. This card runs only on CI's throwaway Postgres, never the shared database; the race tests skip themselves elsewhere. |
| Test Steps | 1. Call `reserveLine` fifty times simultaneously for the bulk type's lines, and again for the serialized type's lines; repeat for ten rounds.<br>2. Count the outcomes and read the type's reservations and the lines' statuses after each round.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/race/invariants.test.ts -t 'Q1-T13 '` on CI's throwaway Postgres and read the named `Q1-T13 ` result. |
| Test Data | Fifty simultaneous `reserveLine` calls per type, ten rounds |
| Expected Result | In every round exactly one call succeeds. The others fail with `InsufficientEquipmentError` (1 requested, 0 available, 1 short). Exactly one `RESERVED` reservation exists for the type, and every losing line is still `CONFIRMED`. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-15 |

> **Expected results are checked by the PR reviewer** against Q1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated race ran on CI's throwaway Postgres, fifty simultaneous attempts per round, ten rounds each for bulk and serialized stock, and its assertions passed; they check the expected result above. |
| Status | Pass (automated, database level) |
| Remarks | Commit: 870e3e7698d5c97b6118ef69fcaa08c2540da429 · Evidence: backend/services/planning-core/tests/race/invariants.test.ts › Q1-T13, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38786048236 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-16 |
