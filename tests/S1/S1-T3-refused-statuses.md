# S1-T3 — A change cannot be requested in a disallowed status

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T3 |
| Test Scenario | Draft, Completed, Cancelled and Rejected events refuse a change request and store nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS.<br>3. Four events like E1, one in each status: Draft, Completed, Cancelled, Rejected. |
| Test Steps | 1. For each of the four events, as ORG, send `POST /api/v1/events/<event>/change-requests` with the body in Test Data.<br>2. Count the rows in `change.change_requests` for the four events.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T3 '` (or the whole suite) and read the named `S1-T3 ` result. |
| Test Data | `{"reason":"x","changes":{"expectedAttendance":160}}` |
| Expected Result | HTTP 409 `EVENT_NOT_CHANGEABLE` for each. The message names the status by its label (Draft, Completed, Cancelled, Rejected) and `details.status` is its code (`DRAFT`, `COMPLETED`, `CANCELLED`, `REJECTED`). There are no `change.change_requests` rows for the four events. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 814b6695b826bc05114f1f5360f3d5739d3ad5e9 · Evidence: backend/services/planning-core/tests/change/api/s1Cards.test.ts › S1-T3, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39051697005 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
