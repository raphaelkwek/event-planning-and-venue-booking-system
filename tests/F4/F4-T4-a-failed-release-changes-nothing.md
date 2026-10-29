# F4-T4 — If a release fails, nothing is cancelled or released and the user is told

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T4 |
| Test Scenario | With the equipment release forced to fail, the whole cancellation rolls back. Automated only |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including F3's `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F4/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F4 from `tests/F4/README.md` is loaded. Specific set-up: E also has a Pending change request CR. |
| Test Steps | 1. In the automated test, make the equipment module's release throw.<br>2. As O, cancel E with the body below, noting the status and body.<br>3. Compare E, its history, slots, holds, requests, lines, reservations, CR and messages with before step 2.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-T4 '` and read the named `F4-T4 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 2 answers 500 `CANCELLATION_FAILED` "The event was not cancelled: something went wrong, so nothing was changed. Try again, or contact support if it keeps happening." Step 3 finds everything as before: E still Planning, B1 Confirmed, H Held, P Pending, R1 and R2 Reserved, CR Pending, no new message. |
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
