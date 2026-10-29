# F3-T3 — Cancels from any status before Completed, Rejected or Cancelled, and refuses those three

## Specification

| Item | Content |
|---|---|
| Test Case ID | F3-T3 |
| Test Scenario | Cancellation is allowed from Draft, Submitted, Under Review, Awaiting Clarification, Approved, Planning, Safety Review and Confirmed, and refused from Completed, Rejected and Cancelled |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F3 from `tests/F3/README.md` is loaded. Specific set-up: one event owned by O and assigned to C in each status, with nothing booked or reserved; the Cancelled one is cancelled through the route first. |
| Test Steps | 1. As O, cancel each event in an allowed status, noting each status code.<br>2. As O, cancel the Completed, Rejected and Cancelled events, reading each event before and after.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f3Cards.test.ts -t 'F3-T3 '` and read the named `F3-T3 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Every step 1 request answers 200 with `previousStatus` the event's old status. Every step 2 request answers 409 `STATUS_TRANSITION_NOT_PERMITTED` with the message `This event is <Completed / Rejected / Cancelled> and cannot move to Cancelled.`, and changes nothing. |
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
