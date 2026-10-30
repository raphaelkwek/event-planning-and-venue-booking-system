# F4-T1 — Cancelling releases the confirmed booking and the hold, and withdraws the pending request

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T1 |
| Test Scenario | Cancelling E frees every venue arrangement it has: B1 and H become Released, P becomes Withdrawn |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including F3's `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F4/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F4 from `tests/F4/README.md` is loaded. |
| Test Steps | 1. As O, send `POST /api/v1/events/<E>/cancellation` with the body below.<br>2. Read E's slots, holds and booking requests.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-T1 '` and read the named `F4-T1 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 1 answers 200 with `released.bookings` [B1], `released.holds` [H] and `released.requests` [P]. Step 2 finds B1's slot and H's slot `RELEASED`, H `RELEASED` with `released_by` O, and P `WITHDRAWN` with `withdrawn_by` O. |
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
