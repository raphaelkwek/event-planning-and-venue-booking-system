# S3-T13 — The coordinator approves a change and sees the impact and the flags on screen

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T13 |
| Test Scenario | End-to-end in the browser: approve a significant change, see the impact list, see the outstanding flags as each of the three roles, and be refused confirmation |
| Pre-conditions | 1. Standard environment running, `.env` has the `KAFKA_*` settings, and test data reset (`tests/README.md`); migrations applied, including `venue/0019` and `equipment/0009` (`npm run migrate -- venue`, `npm run migrate -- equipment`).<br>2. FX-S3 as the browser-level statement in `tests/S3/README.md`: an Approved request of `organiser@connectsphere.test` brought to Planning with two confirmed bookings (Theatre 100 and Hall 200) and an equipment reservation by `techsupport@connectsphere.test`, all for the event's period, and a pending change request raised as in S1-T13 that moves the start time and raises attendance to 150. |
| Test Steps | 1. Sign in as the assigned coordinator, open the change request's review page, click "Approve change", then "Confirm approval".<br>2. Read the impact list that appears.<br>3. Open the event page and read the "Outstanding flags" panel.<br>4. Try to confirm the event (F5).<br>5. Sign out and sign in as `organiser@connectsphere.test`, open the event page, then "Notifications". Repeat the event page as `coordinator2@connectsphere.test`.<br>6. Sign in as `organiser2@connectsphere.test` and open the event's address.<br>7. Sign in as `venuestaff@connectsphere.test`, then as `techsupport@connectsphere.test`, and open "Notifications" in each. |
| Test Data | As in the steps. |
| Expected Result | Step 1 applies the change. Step 2 lists both bookings, the reservation and "0 active registrations", saying which were flagged: both bookings "Requires Reconfirmation", the theatre booking also "Unsuitable" (`Expected attendance is now 150, but <venue> holds 100 in the Theatre layout.`), the reservation "Flagged for review". Step 3 shows the "Outstanding flags" panel with the same flags and reasons. Step 4 is refused and names every flag. Step 5 shows the panel to the organiser and to the other Event Coordinator. Step 6 shows no event (not found) and no flags. Step 7 shows a notice for Venue Staff for each booking and for Technical Support for the reservation. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Manual card. Waits for the S3 implementation and migrations venue/0019 and equipment/0009 on the shared database, applied after the S3 PR merges. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
