# Q1-T3 — A Substituted line reserves the substitute

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T3 |
| Test Scenario | Reserving a Substituted line reserves O2's substitute type and quantity, not the original |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. A PROJECTORS line (quantity 2) set to Substituted with CHAIRS, quantity 5, as substitute. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data.<br>2. Read the rows of `equipment.unit_reservations` for PROJECTORS.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T3 '` (or the whole suite) and read the named `Q1-T3 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 201; the reservation is for CHAIRS with requestedQuantity 5 and reservedQuantity 5. No projector is reserved: `equipment.unit_reservations` has no rows for this line. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-15 |

> **Expected results are checked by the PR reviewer** against Q1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 870e3e7698d5c97b6118ef69fcaa08c2540da429 · Evidence: backend/services/planning-core/tests/equipment/api/q1Cards.test.ts › Q1-T3, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38786048236 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-16 |
