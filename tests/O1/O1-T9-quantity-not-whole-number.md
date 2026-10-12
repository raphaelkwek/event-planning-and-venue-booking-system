# O1-T9 — Negative, fractional and non-numeric quantities are refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T9 |
| Test Scenario | Quantity must be a whole number greater than zero: -1, 1.5 and "ten" are each refused and store nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT. |
| Test Steps | 1. As C1, send `POST /api/v1/equipment/request-lines` three times, with quantity -1, then 1.5, then the text `"ten"`, other fields as in Test Data.<br>2. Count the lines stored for E1 after each.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T9 '` (or the whole suite) and read the named `O1-T9 ` result. |
| Test Data | `{"eventId":"<E1>","lines":[{"equipmentTypeId":"<CHAIRS>","quantity":<value>,"notes":""}]}` with value -1, 1.5 and "ten". |
| Expected Result | Each request returns HTTP 400 `VALIDATION_FAILED` naming `lines.0.quantity`. No line exists for E1 after any of them. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 5d74b7676943cb4a0fb7dc49c76dcae4f614f172 · Evidence: backend/services/planning-core/tests/equipment/api/o1Cards.test.ts › O1-T9, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38195345070 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
