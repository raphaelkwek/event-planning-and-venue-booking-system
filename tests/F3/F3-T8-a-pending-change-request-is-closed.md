# F3-T8 — The pending change request is Closed because the event was cancelled, and can no longer be decided

## Specification

| Item | Content |
|---|---|
| Test Case ID | F3-T8 |
| Test Scenario | Week 9 answer W9-07: a change request still pending when the event is cancelled is closed, saying why, and can't be decided afterwards |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F3 from `tests/F3/README.md` is loaded. |
| Test Steps | 1. As O, cancel E with the body below.<br>2. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f3Cards.test.ts -t 'F3-T8 '` and read the named `F3-T8 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 1's `closedChangeRequest` is CR with `status` `CLOSED`, `closedReason` `The event was cancelled.`, `decidedBy` O and no rejection reason. Step 2 answers 409 `CHANGE_REQUEST_ALREADY_DECIDED` with `details.status` `CLOSED` and the message `This change request was closed on <decidedAt> because the event was cancelled.` |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for CI on the F3 pull request. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
