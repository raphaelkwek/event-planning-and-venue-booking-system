# S2-T7 — Approval is refused once the event can no longer change

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T7 |
| Test Scenario | If E1 was cancelled after the request was raised, approval is refused and nothing changes |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`). |
| Test Steps | 1. In the database, set E1's status to `CANCELLED` (directly, as no API can here).<br>2. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`; read CR1 and E1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T7 '` (or the whole suite) and read the named `S2-T7 ` result. |
| Test Data | `{"decision":"APPROVE"}` |
| Expected Result | HTTP 409 `CHANGE_REQUEST_NO_LONGER_VALID`. CR1 is still `PENDING`. E1 is unchanged (still `CANCELLED`, proposedStartAt `D 14:00`, attendance 150, same version, no new history entry). |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-18 |

> **Expected results are checked by the PR reviewer** against S2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 209b06f5d2dda18e13545ba942220ad38ba9553b · Evidence: backend/services/planning-core/tests/change/api/s2Cards.test.ts › S2-T7, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39054495539 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
