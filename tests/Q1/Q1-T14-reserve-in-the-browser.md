# Q1-T14 — Technical Support reserves a line on screen and the coordinator sees it

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T14 |
| Test Scenario | End-to-end in the browser: the partial-reservation confirmation, the Reserved row and the coordinator's view |
| Pre-conditions | 1. Standard environment running, `.env` has the `KAFKA_*` settings, and test data reset (`tests/README.md`); migrations applied.<br>2. A Confirmed chairs line left by O2-T17's walkthrough (or confirm one the same way), with its assigned coordinator noted. |
| Test Steps | 1. Sign in as `techsupport@connectsphere.test` and open "Equipment requests".<br>2. Click "Reserve" on the Confirmed chairs line and lower the quantity.<br>3. Without ticking "Reserve fewer than requested", click "Reserve equipment".<br>4. Tick "Reserve fewer than requested" and click "Reserve equipment".<br>5. Sign out, sign in as the assigned coordinator, open "Notifications", then the equipment request for the event. |
| Test Data | As in the steps. |
| Expected Result | Step 3 shows the PARTIAL_NOT_CONFIRMED message inline and the line stays Confirmed. Step 4 succeeds and the row shows "Reserved n of m" with Tech Support One and the time. The coordinator's equipment request shows the same, and a notification names the event. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-15 |

> **Expected results are checked by the PR reviewer** against Q1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Steps 1 to 4 and the request screen of step 5 ran in the browser on CI's throwaway stack: Technical Support's Reserve of 30 of 40 without ticking Reserve fewer than requested showed `PARTIAL_NOT_CONFIRMED` and the line stayed Confirmed; ticked, it showed `Reserved 30 of 40 for <event>.` and the row `Reserved 30 of 40` with Tech Support One and the time; the coordinator's equipment request showed the same. Step 5's notification is not proven: notifications are built from Kafka messages, which CI's stack runs without. Proven by tests/e2e/o-equipment.spec.ts › Q1-T14 technical support confirm a partial reservation, and the coordinator sees it, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 (commit 5eb3bfd). UI walk-through in Chrome pending at the sprint review. |
| Executed By | |
| Date of Execution | |
