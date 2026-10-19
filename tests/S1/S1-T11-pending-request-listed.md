# S1-T11 — A pending request is listed and the event is unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T11 |
| Test Scenario | The organiser and the coordinator can read the pending request with its snapshots, and the event still shows its old values |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS.<br>3. The request of S1-T1 is Pending on E1. |
| Test Steps | 1. As ORG, send `GET /api/v1/events/<E1>/change-requests`.<br>2. As C1, send the same request.<br>3. As ORG, send `GET /api/v1/events/<E1>`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T11 '` (or the whole suite) and read the named `S1-T11 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 200 for both lists. `items` has the one request, with status `PENDING`, its reason and both fields, each with its snapshot (`D 14:00`, 150) and proposed value (`D 15:00`, 180). The event read shows proposedStartAt `D 14:00` and expectedAttendance 150. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 814b6695b826bc05114f1f5360f3d5739d3ad5e9 · Evidence: backend/services/planning-core/tests/change/api/s1Cards.test.ts › S1-T11, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39051697005 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
