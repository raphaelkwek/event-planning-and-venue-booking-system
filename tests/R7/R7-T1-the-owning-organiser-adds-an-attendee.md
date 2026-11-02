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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T1 adds an attendee for the owning organiser: Registered, manual, who, when and why, and the attendee is told, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
