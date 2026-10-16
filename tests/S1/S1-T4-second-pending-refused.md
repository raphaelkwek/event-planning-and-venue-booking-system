# S1-T4 — A second pending request for the same event is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T4 |
| Test Scenario | While one request is pending, another for the same event is refused, names the pending one and stores nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS.<br>3. The request of S1-T1 is Pending on E1. |
| Test Steps | 1. As ORG, send `POST /api/v1/events/<E1>/change-requests` with the body in Test Data.<br>2. Count the rows in `change.change_requests` for E1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T4 '` (or the whole suite) and read the named `S1-T4 ` result. |
| Test Data | `{"reason":"Also more people","changes":{"expectedAttendance":200}}` |
| Expected Result | HTTP 409 `CHANGE_REQUEST_ALREADY_PENDING`. The message names the existing request's time. `details` has the existing request's id, its requestedAt and its fields `["proposedStartAt","expectedAttendance"]`. There is still exactly one request for E1, and it is unchanged. |
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
