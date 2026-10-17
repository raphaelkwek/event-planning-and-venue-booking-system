# S1-T9 — The assigned coordinator is notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T9 |
| Test Scenario | A request puts one change-request.submitted message on the event topic and the notification service turns it into one notification for the assigned coordinator |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS. |
| Test Steps | 1. As ORG, send `POST /api/v1/events/<E1>/change-requests` with the body in Test Data.<br>2. Read `change.outbox` for the request.<br>3. Pass the message through the notification service's recipient rule (the test calls it directly; the browser walk-through is S1-T13) and read C1's notifications.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T9 '` (or the whole suite) and read the named `S1-T9 ` result. |
| Test Data | `{"reason":"Keynote speaker arrives late","changes":{"proposedStartAt":"D 15:00","expectedAttendance":180}}` |
| Expected Result | One `change-request.submitted` message in `change.outbox`, on the event topic (`KAFKA_TOPICS.event`) and keyed by E1's id. Its data names E1's reference, C1 as the coordinator, the request id and the fields `["proposedStartAt","expectedAttendance"]`. The recipient rule yields exactly one notification, for C1, whose text contains E1's reference, "start" and "expected attendance". |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 814b6695b826bc05114f1f5360f3d5739d3ad5e9 · Evidence: backend/services/planning-core/tests/change/api/s1Cards.test.ts › S1-T9, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39051697005 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
