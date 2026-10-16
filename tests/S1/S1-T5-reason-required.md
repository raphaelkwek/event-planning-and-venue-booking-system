# S1-T5 — A reason is mandatory

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T5 |
| Test Scenario | A missing, empty or blank reason is refused on the reason field and nothing is stored |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS. |
| Test Steps | 1. As ORG, send `POST /api/v1/events/<E1>/change-requests` with changes as in Test Data and no `reason`.<br>2. Repeat with `"reason":""`.<br>3. Repeat with `"reason":"   "`.<br>4. Count the rows in `change.change_requests` for E1.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T5 '` (or the whole suite) and read the named `S1-T5 ` result. |
| Test Data | `"changes":{"proposedStartAt":"D 15:00","expectedAttendance":180}` with the reason as the steps give |
| Expected Result | HTTP 400 `VALIDATION_FAILED` for each of the three, naming the field `reason`. There are no `change.change_requests` rows for E1. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S1 implementation and migration change/0001 (CI runs it on the throwaway Postgres). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
