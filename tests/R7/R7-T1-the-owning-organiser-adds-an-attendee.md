# R7-T1 — The owning organiser adds an attendee: Registered, marked as manually added, with who added it, when and the reason, and the attendee is notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T1 |
| Test Scenario | The owning organiser adds an attendee: Registered, marked as manually added, with who added it, when and the reason, and the attendee is notified |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Kafka configured.<br>2. FX-R-EVENT with its defaults (3 seats), then FX-R-MANAGED.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. open `#/events/<EVENT_ID>/registrations` (the "Registrations" button on the event).<br>2. Under "Add an attendee", enter `attendee@connectsphere.test` and the reason `Keynote speaker's guest`, and click "Add attendee".<br>3. Read the dialog, then click "Add attendee".<br>4. As Attendee One, open "Notifications" and "My registrations". |
| Test Data | Attendee One; reason `Keynote speaker's guest` |
| Expected Result | Step 3: the dialog shows `Capacity 3` and `With this addition: 1 attendee`. Afterwards a row: `Attendee One`, `Registered`, `Added by Organiser One` with the time and the reason; places remaining 2. Step 4: `Organiser One added you to EVT-R… “R Test Symposium” … Registration REG-… is confirmed.`, and the registration is listed. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Step 3: the dialog showed `Capacity 3` and `With this addition: 1 attendee` (no over-capacity warning); the addition answered 201 (`Attendee One was added: registration REG-….`). The row then read `Attendee One`, the time, `Registered`, `Added by Organiser One` with `“Keynote speaker's guest”` (stored REGISTERED, added by Organiser One, that reason, not over capacity), and the totals read `Places remaining 2` and `Capacity 3`. Step 4: the addition's `registration.added` was stored by the notification service (the notification was delivered by the test harness (deliverOutbox, the consumers' own code) in place of Kafka, which CI's stack runs without); Attendee One's Notifications read `Organiser One added you to EVT-R… “R Test Symposium …” on Wednesday 16 December 2026, 14:00–18:00. Registration REG-… is confirmed; you can withdraw it from My registrations.`, and My registrations listed that registration as Registered. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: c0f7183 · Evidence: tests/e2e/r-management.spec.ts › R7-T1 the owning organiser adds an attendee, seeing the capacity and the new total first, and the attendee is told, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
