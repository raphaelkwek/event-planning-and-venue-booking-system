# O1-T21 — A coordinator who is not assigned to the event cannot write lines

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T21 |
| Test Scenario | Only the event's assigned coordinator may record, edit or remove lines; a different coordinator is refused and nothing is stored or changed |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted) recorded by C1. |
| Test Steps | 1. As C2 (a coordinator not assigned to E1), send `POST /api/v1/equipment/request-lines` with the body of O1-T1.<br>2. As C2, send `PUT /api/v1/equipment/request-lines/<id>` with quantity 10.<br>3. As C2, send `POST /api/v1/equipment/request-lines/<id>/removal`.<br>4. As C2, send `GET /api/v1/equipment/request-lines/<id>`.<br>5. Read the line rows for E1 and their history.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T21 '` (or the whole suite) and read the named `O1-T21 ` result. |
| Test Data | The body of O1-T1; quantity 10. |
| Expected Result | Step 1 returns HTTP 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you.". Steps 2 to 4 return HTTP 404 `EQUIPMENT_LINE_NOT_FOUND`, "No equipment request line with that id is on an event assigned to you.". E1 still has exactly the one line, unchanged (quantity 40, Submitted), and its history is unchanged. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** Another coordinator gets 404, as for an unknown event or line, rather than 403. Step 4 is new: reading the line by id.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Saving returned 404 EVENT_NOT_FOUND "No event with that reference is assigned to you."; the edit, removal and read returned 404 EQUIPMENT_LINE_NOT_FOUND "No equipment request line with that id is on an event assigned to you.". The line and its history were unchanged. |
| Status | Pass |
| Remarks | Commit: 6f59d76, automated, on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
