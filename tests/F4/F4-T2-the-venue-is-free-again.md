# F4-T2 — The venue's period is free again in I1's calendar, and a new booking for it can be stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T2 |
| Test Scenario | After cancellation V1's period no longer shows E's booking in the availability calendar (I1), which venue search (J1) reads from the same slots, and another booking for the same period can be stored |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including F3's `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F4/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F4 from `tests/F4/README.md` is loaded. |
| Test Steps | 1. As VS, send `GET /api/v1/venues/<V1>/availability?from=<D>&to=<D+1>` and note the bookings' event references.<br>2. As O, cancel E with the body below.<br>3. As VS, read the calendar again.<br>4. Store a confirmed booking at V1 for E's period for another event.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-T2 '` and read the named `F4-T2 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 1 lists a booking for E. Step 3 lists none. Step 4 succeeds: the slot exclusion no longer counts B1. |
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
