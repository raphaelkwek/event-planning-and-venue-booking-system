# O1-T16 — Confirmed, Unavailable, Substituted and Removed lines cannot be edited

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T16 |
| Test Scenario | The story allows editing only while Submitted or Under Review; any other status refuses the edit |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. Four lines for E1, one in each status `CONFIRMED`, `UNAVAILABLE`, `SUBSTITUTED` and `REMOVED`. |
| Test Steps | 1. As C1, send `PUT /api/v1/equipment/request-lines/<id>` for each of the four lines with quantity 10 and the other fields unchanged.<br>2. Read each line row again.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T16 '` (or the whole suite) and read the named `O1-T16 ` result. |
| Test Data | Quantity 10; every other field as currently stored. |
| Expected Result | Each request returns HTTP 409 `EQUIPMENT_LINE_NOT_EDITABLE` naming that line's status. All four rows are unchanged. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 5d74b7676943cb4a0fb7dc49c76dcae4f614f172 · Evidence: backend/services/planning-core/tests/equipment/api/o1Cards.test.ts › O1-T16, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38195345070 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-12 |
