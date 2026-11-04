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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Steps 1 and 2 ran in the browser on CI's throwaway stack: Leave the waitlist asked first (`Leave the waitlist?`, naming the event and the entry), then the entry read `Left the waitlist` with `Left <time>` and stayed listed (stored WITHDRAWN); after Attendee Two withdrew, the left entry was not told (its last-told time stayed empty). Step 3 (no notice in Notifications) is not proven: notifications are built from Kafka messages, which CI's stack runs without. Attendee Two was added to the job's own database. Proven by tests/e2e/r-management.spec.ts › R6-T8 an attendee leaves the waitlist; the entry is kept and later openings pass it by, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 (commit 5eb3bfd). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
