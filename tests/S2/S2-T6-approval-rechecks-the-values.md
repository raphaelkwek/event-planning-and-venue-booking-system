# S2-T6 — Approval re-checks the proposed values and refuses ones that no longer pass

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T6 |
| Test Scenario | If CR1's proposed start has since passed, approval is refused with the field named and nothing changes, while rejection still works |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`). |
| Test Steps | 1. In the database, set CR1's proposed start to now minus 1 day (directly, as no API can).<br>2. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`; read CR1 and E1.<br>3. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"REJECT","reason":"The new time has passed"}`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T6 '` (or the whole suite) and read the named `S2-T6 ` result. |
| Test Data | As in the steps. |
| Expected Result | The approval returns HTTP 409 `CHANGE_REQUEST_NO_LONGER_VALID` with `details.fields` naming `changes.proposedStartAt`; CR1 is still `PENDING` and E1 is unchanged (no new history entry, same version). The rejection then returns HTTP 200 with status `REJECTED` and the reason. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-18 |

> **Expected results are checked by the PR reviewer** against S2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 209b06f5d2dda18e13545ba942220ad38ba9553b · Evidence: backend/services/planning-core/tests/change/api/s2Cards.test.ts › S2-T6, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39054495539 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
