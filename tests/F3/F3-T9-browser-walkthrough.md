# F3-T9 — Browser walkthrough: cancel an event, and see it cancelled

## Specification

| Item | Content |
|---|---|
| Test Case ID | F3-T9 |
| Test Scenario | Signed in for real, the owner cancels their event from its page with a reason; the coordinator then sees it cancelled, with the reason and date. Manual |
| Pre-conditions | 1. The app runs against the team's database with migrations `event/0012`, `event/0013`, `change/0004` and `change/0005` applied, as in `tests/README.md`.<br>2. FX-F3 at browser level from `tests/F3/README.md`. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test` and open the event's page from My requests.<br>2. Select **Cancel event**, then **Cancel event** in the dialog with the reason empty.<br>3. Enter `The speaker withdrew.` and select **Cancel event**.<br>4. Sign out, sign in as `coordinator@connectsphere.test` and open the event from the review queue's All events.<br>5. Open Notifications as each of the four users. |
| Test Data | Reason `The speaker withdrew.` |
| Expected Result | Step 2: the dialog says what will happen and that it can't be undone, and shows `Give a reason for cancelling the event.`; nothing is sent. Step 3: the dialog closes; the page shows **This event was cancelled** with the reason and date, the status Cancelled, no **Cancel event**, **Edit details** or **Request a change**, and the change request shown as closed. Step 4: the coordinator sees the same banner and no **Cancel event** or **Confirm arrangements**. Step 5: the organiser, coordinator, `venuestaff@connectsphere.test` and `techsupport@connectsphere.test` each have one cancellation notice with the reason. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Manual. Waits for the merge and for the team to apply the four migrations to the shared database. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
