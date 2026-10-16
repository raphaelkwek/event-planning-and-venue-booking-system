# S1-T2 — A change can be requested in every allowed status

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T2 |
| Test Scenario | Submitted, Under Review, Awaiting Clarification, Approved, Planning, Safety Review and Confirmed events each accept a change request |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS.<br>3. Seven events like E1 (same owner ORG, coordinator C1 and values), one in each status: Submitted, Under Review, Awaiting Clarification, Approved, Planning, Safety Review, Confirmed. |
| Test Steps | 1. For each of the seven events, as ORG, send `POST /api/v1/events/<event>/change-requests` with the body in Test Data.<br>2. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T2 '` (or the whole suite) and read the named `S1-T2 ` result. |
| Test Data | `{"reason":"x","changes":{"expectedAttendance":160}}` |
| Expected Result | HTTP 201 for each of the seven events, each with status `PENDING` and one field `expectedAttendance` (current 150, proposed 160). |
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
