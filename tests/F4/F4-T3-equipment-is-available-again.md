# F4-T3 — Both reservations are released, and the whole stock is available for the period again

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T3 |
| Test Scenario | Cancelling releases R1 and R2 and gives their quantities back |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including F3's `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F4/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F4 from `tests/F4/README.md` is loaded. |
| Test Steps | 1. As T, send `GET /api/v1/equipment/types/<chairs>/availability?startsAt=<E start>&endsAt=<E end>&requestedQuantity=1`.<br>2. As O, cancel E with the body below.<br>3. Read R1 and R2, and repeat step 1.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-T3 '` and read the named `F4-T3 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 1 answers `availableQuantity` 2 (10 − 5 − 3). Step 2's `released.reservations` lists quantities 5 and 3. In step 3 R1, R2 and their bulk rows are `RELEASED` and `availableQuantity` is 10. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F4's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for CI on the F4 pull request. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
