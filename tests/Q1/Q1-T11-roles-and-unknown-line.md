# Q1-T11 — Only Technical Support can reserve; an unknown line is not found

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T11 |
| Test Scenario | Other roles are refused and an unknown line id returns not found |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. A CHAIRS line (quantity 4, Confirmed) for E1. |
| Test Steps | 1. Send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data, as C1, then as ORG, VS and ATT in turn.<br>2. As TS, send the same request to an unknown line id.<br>3. Read the line's row.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T11 '` (or the whole suite) and read the named `Q1-T11 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 403 for each of C1, ORG, VS and ATT, and the line is unchanged. HTTP 404 `EQUIPMENT_LINE_NOT_FOUND` for the unknown id. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-15 |

> **Expected results are checked by the PR reviewer** against Q1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 870e3e7698d5c97b6118ef69fcaa08c2540da429 · Evidence: backend/services/planning-core/tests/equipment/api/q1Cards.test.ts › Q1-T11, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38786048236 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-16 |
