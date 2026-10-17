# S1-T1 — The owning organiser requests a change and the request records the snapshot

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T1 |
| Test Scenario | A valid request is stored Pending with the reason, requester, time, a snapshot of each current value and the proposed values, and the event itself is unchanged |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS. |
| Test Steps | 1. As ORG, send `POST /api/v1/events/<E1>/change-requests` with the body in Test Data, noting the instants just before and just after the request.<br>2. As ORG, send `GET /api/v1/events/<E1>`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T1 '` (or the whole suite) and read the named `S1-T1 ` result. |
| Test Data | `{"reason":"Keynote speaker arrives late","changes":{"proposedStartAt":"D 15:00","expectedAttendance":180}}` |
| Expected Result | HTTP 201. The request has a generated id, status `PENDING`, reason `Keynote speaker arrives late`, requestedBy ORG and requestedAt between the instants around the request. It has exactly two fields: `proposedStartAt` (current `D 14:00`, proposed `D 15:00`) and `expectedAttendance` (current 150, proposed 180). The event read still shows proposedStartAt `D 14:00` and expectedAttendance 150. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 814b6695b826bc05114f1f5360f3d5739d3ad5e9 · Evidence: backend/services/planning-core/tests/change/api/s1Cards.test.ts › S1-T1, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39051697005 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
