# O1-T18 — Removing a Submitted line sets a status and records the removal

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T18 |
| Test Scenario | Removal records the acting user, timestamp, equipment type and quantity, and keeps the record |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted) recorded by C1. |
| Test Steps | 1. As C1, send `POST /api/v1/equipment/request-lines/<id>/removal` with an empty JSON object.<br>2. Select the row from `equipment.equipment_request_lines` by id.<br>3. As C1, send `GET /api/v1/equipment/request-lines?eventId=<E1>` and `GET /api/v1/equipment/request-lines/<id>`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T18 '` (or the whole suite) and read the named `O1-T18 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 200 and the line shows status `REMOVED`. The row still exists in the database (not deleted). The detail's history has a `REMOVED` entry with actor C1, a timestamp between the instants around the request, equipment type name `O1 Folding Chairs` and quantity 40. The list for E1 no longer shows the line. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
