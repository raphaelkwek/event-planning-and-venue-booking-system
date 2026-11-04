# R6-T6 — When a place becomes available through a withdrawal, every waitlisted attendee is notified a place is open, and no registration is created for them

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T6 |
| Test Scenario | When a place becomes available through a withdrawal, every waitlisted attendee is notified a place is open, and no registration is created for them |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Kafka configured, and Attendee Two's account (`tests/R5/README.md`).<br>2. FX-R-EVENT with `<SEATS>` 1; Attendee Two registers (R2-T1 steps 1–2), taking the seat.<br>3. Attendee One joins the waitlist (R6-T1 step 1). |
| Test Steps | 1. As Attendee Two, withdraw (R4-T1 steps 1–3).<br>2. As Attendee One, wait a few seconds and click "Notifications".<br>3. Open "My registrations". |
| Test Data | 1 seat; Attendee One waitlisted |
| Expected Result | Step 2: `A place has opened at EVT-R… “R Test Symposium”. Register now if you still want one: places go to whoever registers first.` Step 3: no registration for the event; the waitlist entry is still `Waitlisted`, with when it was last told of a place. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With the 1-seat event's seat held by Attendee Two and Attendee One on the waitlist, Attendee Two withdrew from My registrations in the browser (200). The messages the withdrawal wrote reached the notification service, which stored `waitlist.place-opened` (the notification was delivered by the test harness (deliverOutbox, the consumers' own code) in place of Kafka, which CI's stack runs without). Step 2: Attendee One's Notifications held exactly one notice about the event: `A place has opened at EVT-R… “R Test Symposium …”. Register now if you still want one: places go to whoever registers first.` Step 3: My registrations listed no registration for the event; the waitlist entry still read `Waitlisted`, with `A place opened on <time>. Register if one is still free.` (stored WAITLISTED, last told at that time), and the database held no registration of Attendee One for the event. Unique event names in place of the card's literal name; Attendee Two was added to the job's own database. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/r-management.spec.ts › R6-T6 a withdrawal tells the waitlist and registers nobody, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
