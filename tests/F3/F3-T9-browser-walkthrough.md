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
| Created By | Raphael |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Step 2: the owner's Cancel event dialog said what would happen and `This can't be undone.`; Cancel event with no reason showed `Give a reason for cancelling the event.` and the event was not cancelled. Step 3: with `The speaker withdrew.` the dialog closed; the page showed `This event was cancelled` with the reason and date, the status Cancelled, no Cancel event, Edit details or Request a change, and `Change request closed`. Step 4: the coordinator saw the same banner and reason, and no Cancel event or Confirm arrangements. Step 5: the cancellation's `event.cancelled` was stored by the notification service (the notification was delivered by the test harness (deliverOutbox, the consumers' own code) in place of Kafka, which CI's stack runs without); each of the four had exactly one notice about the event, with the reason: the organiser `Your event EVT-… “…” has been cancelled. Reason: The speaker withdrew.`, the coordinator `The event EVT-… “…” has been cancelled. Reason: The speaker withdrew.`, venuestaff@connectsphere.test `EVT-… “…” has been cancelled. Reason: The speaker withdrew. Released: booking <reference> at <venue>, Tuesday 2 March 2027, 14:00–18:00.`, and techsupport@connectsphere.test `EVT-… “…” has been cancelled. Reason: The speaker withdrew. The equipment you reserved has been released: <type> × 5.` Run on CI's throwaway stack (the team's database is never used), with the event on 2 March 2027 so it is never in the past. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/u-safety-and-assignment.spec.ts › F3-T9 the owner cancels their event from its page with a reason; the coordinator sees the same, and all four are told, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
