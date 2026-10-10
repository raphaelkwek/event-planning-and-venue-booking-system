# O1-T17 — An invalid edit changes nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T17 |
| Test Scenario | A rejected save changes no line item |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted) from O1-T1. |
| Test Steps | 1. As C1, send `PUT /api/v1/equipment/request-lines/<id>` with quantity 0 (otherwise valid).<br>2. As C1, send `PUT /api/v1/equipment/request-lines/<id>` with requiredFrom and requiredTo both `D 15:00`.<br>3. Read the line row and its history rows.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T17 '` (or the whole suite) and read the named `O1-T17 ` result. |
| Test Data | Quantity 0; then equal times `D 15:00`/`D 15:00`. |
| Expected Result | Both requests return HTTP 400 `VALIDATION_FAILED` (naming `quantity`, then `requiredTo`). The row (including updatedAt) and its history are identical to before. |
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
