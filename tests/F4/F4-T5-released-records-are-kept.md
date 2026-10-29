# F4-T5 — Each released record is kept, with the reason, the user and the time

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T5 |
| Test Scenario | Nothing is deleted: each released booking, hold and reservation stays, as Released, recording why, who and when |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including F3's `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F4/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F4 from `tests/F4/README.md` is loaded. |
| Test Steps | 1. As O, cancel E with the body below.<br>2. Read E's slots, holds and reservations.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-T5 '` and read the named `F4-T5 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Both slots are still there: B1 `RELEASED` with `release_reason` `event cancelled`, `updated_by` O and an `updated_at`; H `RELEASED` with `released_by` O and a `released_at`; R1 and R2 still there, `RELEASED` with `release_reason` `event cancelled`, `released_by` O and a `released_at`. |
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
