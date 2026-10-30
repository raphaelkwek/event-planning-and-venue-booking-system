# F4-T6 — Releasing again changes nothing, and a second cancellation is refused with nothing changed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T6 |
| Test Scenario | Running the release again, or retrying the cancellation, reaches the same end state |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including F3's `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F4/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F4 from `tests/F4/README.md` is loaded. |
| Test Steps | 1. As O, cancel E with the body below, then read everything.<br>2. In the automated test, run the venue and equipment release functions for E again.<br>3. As O, cancel E again.<br>4. Read everything again.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-T6 '` and read the named `F4-T6 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 2 releases nothing (no references, no reservations). Step 3 answers 409 `STATUS_TRANSITION_NOT_PERMITTED`. Step 4 finds every row, quantity and timestamp as in step 1. |
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
