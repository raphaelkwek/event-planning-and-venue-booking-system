# O1-T21 — A coordinator who is not assigned to the event cannot write lines

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T21 |
| Test Scenario | Only the event's assigned coordinator may record, edit or remove lines; a different coordinator is refused and nothing is stored or changed |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted) recorded by C1. |
| Test Steps | 1. As C2 (a coordinator not assigned to E1), send `POST /api/v1/equipment/request-lines` with the body of O1-T1.<br>2. As C2, send `PUT /api/v1/equipment/request-lines/<id>` with quantity 10.<br>3. As C2, send `POST /api/v1/equipment/request-lines/<id>/removal`.<br>4. Read the line rows for E1 and their history.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T21 '` (or the whole suite) and read the named `O1-T21 ` result. |
| Test Data | The body of O1-T1; quantity 10. |
| Expected Result | All three requests return HTTP 403 `ROLE_NOT_AUTHORISED`. E1 still has exactly the one line, unchanged (quantity 40, Submitted), and its history is unchanged. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 5d74b7676943cb4a0fb7dc49c76dcae4f614f172 · Evidence: backend/services/planning-core/tests/equipment/api/o1Cards.test.ts › O1-T21, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38195345070 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
