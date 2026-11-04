# R6-T8 — An attendee leaves the waitlist: the entry is kept as Withdrawn and they are not told of later openings

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T8 |
| Test Scenario | An attendee leaves the waitlist: the entry is kept as Withdrawn and they are not told of later openings |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Kafka configured, and Attendee Two's account (`tests/R5/README.md`).<br>2. FX-R-EVENT with `<SEATS>` 1; Attendee Two registers; Attendee One joins the waitlist. |
| Test Steps | 1. As Attendee One, in "My registrations", on the waitlist entry, click "Leave the waitlist", then confirm.<br>2. As Attendee Two, withdraw, so a place opens.<br>3. As Attendee One, wait a few seconds and click "Notifications". |
| Test Data | Attendee One's entry from R6-T1 |
| Expected Result | Step 1: the dialog asks first; the entry then reads `Left the waitlist` with its time, and is still listed. Step 3: no notice that a place opened. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Step 1: Leave the waitlist asked first (`Leave the waitlist?`, `You will no longer be told when a place opens at EVT-R… “R Test Symposium …”. Entry WL-… will show as Left the waitlist.`); after confirming (200) the entry read `Left the waitlist` with `Left <time>` and stayed listed (stored WITHDRAWN). Step 2: Attendee Two withdrew in the browser (200), so a place opened; the left entry was not told (its last-told time stayed empty). Step 3: the withdrawal's messages were delivered (the notification was delivered by the test harness (deliverOutbox, the consumers' own code) in place of Kafka, which CI's stack runs without): the notification service stored Attendee Two's `registration.withdrawn`, and no `waitlist.place-opened` was written for anyone; Attendee One's Notifications held no notice about the event, so none that a place opened. Attendee Two was added to the job's own database. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/r-management.spec.ts › R6-T8 an attendee leaves the waitlist; the entry is kept and later openings pass it by, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
