# S2-T1 — The assigned coordinator approves and the change is applied with field history

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T1 |
| Test Scenario | Approval updates the event's fields to the proposed values and records each field's before value, after value, deciding coordinator and time |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`). |
| Test Steps | 1. As C1, send `GET /api/v1/events/<E1>` and note the version and the history entries.<br>2. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with the body in Test Data, noting the instants just before and just after the request.<br>3. As C1, send `GET /api/v1/events/<E1>` and read the event and its history.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T1 '` (or the whole suite) and read the named `S2-T1 ` result. |
| Test Data | `{"decision":"APPROVE"}` |
| Expected Result | HTTP 200. `changeRequest.status` is `APPROVED`, `decidedBy` is C1, `decidedAt` is between the instants around the request and `rejectionReason` is null. The event now shows proposedStartAt `D 15:00`, proposedEndAt `D 18:00` and expectedAttendance 180, and its version is one higher than before. Its history has exactly two new FIELD_CHANGE entries: `proposedStartAt` `D 14:00` → `D 15:00` and `expectedAttendance` `150` → `180`, each by C1 (EVENT_COORDINATOR) with a timestamp within the request. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-18 |

> **Expected results are checked by the PR reviewer** against S2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S2 implementation and migrations change/0002 and change/0003 (CI runs them on the throwaway Postgres). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
