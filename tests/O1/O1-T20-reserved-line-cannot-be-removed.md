# O1-T20 — A Reserved line cannot be removed

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T20 |
| Test Scenario | A Reserved line with no active reservation cannot be removed |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40) with status `RESERVED`. |
| Test Steps | 1. As C1, send `POST /api/v1/equipment/request-lines/<id>/removal`.<br>2. Read the line row and its history rows again.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T20 '` (or the whole suite) and read the named `O1-T20 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 409 `EQUIPMENT_LINE_NOT_EDITABLE` naming the status Reserved. Row and history are identical to before; no `REMOVED` history entry exists. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

> **Revised 2026-10-17 for Q2**: Q2 (SPM-51) now lets the assigned coordinator remove a Reserved line and releases its
> reservation (see Q2-T8), so this card now covers only the edge case of a Reserved line without an active reservation.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 5d74b7676943cb4a0fb7dc49c76dcae4f614f172 · Evidence: backend/services/planning-core/tests/equipment/api/o1Cards.test.ts › O1-T20, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38195345070 · Defect: — · Behaviour revised by Q2; the revised test passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38932644480 against cc43643. |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
