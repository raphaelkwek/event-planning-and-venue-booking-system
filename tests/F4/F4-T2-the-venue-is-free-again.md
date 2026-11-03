# F4-T2 — The venue's period is free again in I1's calendar and J1's search, and a new booking for it can be stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T2 |
| Test Scenario | After cancellation V1's period no longer shows E's booking in the availability calendar (I1), venue search (J1) offers V1 for the period again, and another booking for the same period can be stored |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including F3's `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F4/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F4 from `tests/F4/README.md` is loaded. |
| Test Steps | 1. As C2 (an Event Coordinator), search venues with `GET /api/v1/venues/search?q=<V1's name>&from=<E's start>&to=<E's end>` (J1), V1 being open all day.<br>2. As VS, send `GET /api/v1/venues/<V1>/availability?from=<D>&to=<D+1>` and note the bookings' event references.<br>3. As O, cancel E with the body below.<br>4. As VS, read the calendar again.<br>5. As C2, run step 1's search again.<br>6. Store a confirmed booking at V1 for E's period for another event.<br>7. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-T2 '` and read the named `F4-T2 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 1 answers 200 without V1: B1 occupies E's period. Step 2 lists a booking for E. Step 4 lists none. Step 5 answers 200 offering V1, the released period being free again. Step 6 succeeds: the slot exclusion no longer counts B1. |
| Created By | Raphael |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F4's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Steps 1 and 5 (J1's search) added on 2026-11-03 after the review of #72; the run recorded before them (CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41597952863) did not search. Waits for CI. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
