# Q2-T2 — Releasing a serialized line frees both units

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T2 |
| Test Scenario | Releasing a reservation of a serialized line sets every unit reservation of it to Released, so the units count as available again |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q2 from `tests/Q2/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), the actors TS, C1, ORG, VS and ATT, and line L1 (CHAIRS × 4 for E1, Confirmed, then reserved by TS through `POST /api/v1/equipment/request-lines/<L1>/reservation`, leaving 6 CHAIRS).<br>3. A PROJECTORS line (quantity 2, Confirmed) for E1, reserved by TS (units `P-01` and `P-02`). |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/release` for that line with the body in Test Data.<br>2. Read the `unit_reservations` rows of the reservation.<br>3. As TS, send `GET /api/v1/equipment/types/<PROJECTORS>/availability` for E1's window with requestedQuantity 1.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q2Cards.test.ts -t 'Q2-T2 '` (or the whole suite) and read the named `Q2-T2 ` result. |
| Test Data | `{"reason":"Not needed"}` |
| Expected Result | HTTP 200. Both `unit_reservations` rows of the reservation are `RELEASED`. The availability for E1's window shows availableQuantity 3. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-16 |

> **Expected results are checked by the PR reviewer** against Q2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cc43643b6269cae9c30c54d2cdf6081afb8bf003 · Evidence: backend/services/planning-core/tests/equipment/api/q2Cards.test.ts › Q2-T2, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38932644480 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-17 |
