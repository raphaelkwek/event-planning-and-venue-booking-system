# G2-T8 — The coordinator sees what a pending change would affect, in the browser

## Specification

| Item | Content |
|---|---|
| Test Case ID | G2-T8 |
| Test Scenario | End-to-end in the browser: the assigned coordinator opens a pending change request's review page and sees which arrangements approval would flag and why, before deciding; nothing is flagged by looking |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`); migrations applied, including `venue/0018` and `equipment/0009`.<br>2. FX-G2 as the browser-level statement in `tests/G2/README.md`: a Planning event of `organiser@connectsphere.test` with two confirmed bookings (Theatre 100 and Hall 200) and an equipment reservation by `techsupport@connectsphere.test`, all for the event's period, and a pending change request that moves the start time and raises attendance to 150. |
| Test Steps | 1. Sign in as the assigned coordinator and open the change request's review page.<br>2. Read the "If this change is approved" section above the Approve and Reject actions.<br>3. Open the event page and read the "Outstanding flags" panel.<br>4. Back on the review page, reject the change with a reason, and read the page again.<br>5. On another event with a pending change to the venue requirements only, open its review page. |
| Test Data | As in the steps. |
| Expected Result | Step 2 lists both bookings, the reservation and "0 active registrations", saying which would be flagged and why: both bookings "Requires reconfirmation" with the period reason, the theatre booking also "Unsuitable" (`Expected attendance is now 150, but <venue> holds 100 in the Theatre layout.`), the reservation "Flagged for review". Step 3 shows no outstanding flags (viewing flagged nothing). In step 4 the section is gone, since the request is decided. Step 5 lists the arrangements and flags none. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against G2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Manual card. Waits for the G2 screen (Task 3) and migrations venue/0018 and equipment/0009 on the shared database. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
