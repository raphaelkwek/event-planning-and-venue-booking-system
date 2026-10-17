# S1-T7 — Only the six significant fields can be proposed

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T7 |
| Test Scenario | A field outside the six, an empty changes object and a missing changes object are refused and nothing is stored |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS. |
| Test Steps | 1. As ORG, send `POST /api/v1/events/<E1>/change-requests` with each body in Test Data in turn.<br>2. Count the rows in `change.change_requests` for E1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T7 '` (or the whole suite) and read the named `S1-T7 ` result. |
| Test Data | `{"reason":"x","changes":{"purpose":"New"}}`; `{"reason":"x","changes":{}}`; `{"reason":"x"}` |
| Expected Result | HTTP 400 `VALIDATION_FAILED` for each. The first names `changes.purpose` with the message "Change this through Edit details.". The second and third name `changes` with the message "Propose at least one change.". There are no `change.change_requests` rows for E1. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 814b6695b826bc05114f1f5360f3d5739d3ad5e9 · Evidence: backend/services/planning-core/tests/change/api/s1Cards.test.ts › S1-T7, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39051697005 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
