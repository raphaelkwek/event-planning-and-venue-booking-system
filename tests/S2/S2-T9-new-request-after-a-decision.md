# S2-T9 — The organiser can raise a new request once the earlier one is decided

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T9 |
| Test Scenario | A decision frees the event for another request, and the one-pending rule still applies to that one |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`). |
| Test Steps | 1. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`.<br>2. As ORG, send `POST /api/v1/events/<E1>/change-requests` with the body in Test Data.<br>3. As ORG, send the same request again.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T9 '` (or the whole suite) and read the named `S2-T9 ` result. |
| Test Data | `{"reason":"More people registered","changes":{"expectedAttendance":200}}` |
| Expected Result | The new request returns HTTP 201 with status `PENDING`. The third request returns HTTP 409 `CHANGE_REQUEST_ALREADY_PENDING`, naming the new request. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-18 |

> **Expected results are checked by the PR reviewer** against S2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 209b06f5d2dda18e13545ba942220ad38ba9553b · Evidence: backend/services/planning-core/tests/change/api/s2Cards.test.ts › S2-T9, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39054495539 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
