# S1-T8 — The boundary values are accepted

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T8 |
| Test Scenario | An expected attendance of 1 and a start one minute from now are the smallest values accepted |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS.<br>3. For part (b), a fresh FX-S1 (a second E1), because part (a) leaves a request pending on the first. |
| Test Steps | 1. As ORG, send `POST /api/v1/events/<E1>/change-requests` with body (a) in Test Data.<br>2. In the fresh FX-S1, as ORG, send `POST /api/v1/events/<E1>/change-requests` with body (b), computing the times at the moment of the request.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T8 '` (or the whole suite) and read the named `S1-T8 ` result. |
| Test Data | (a) `{"reason":"x","changes":{"expectedAttendance":1}}`; (b) `{"reason":"x","changes":{"proposedStartAt":"<now plus 1 minute>","proposedEndAt":"<now plus 2 hours>"}}` |
| Expected Result | HTTP 201 for both. (a) has one field `expectedAttendance` (current 150, proposed 1). (b) has fields `proposedStartAt` and `proposedEndAt`, each with its current value and the proposed one. |
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
