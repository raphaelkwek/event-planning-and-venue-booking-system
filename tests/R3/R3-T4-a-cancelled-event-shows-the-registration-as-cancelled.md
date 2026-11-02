# R3-T4 — When an event is cancelled, the attendee's registration is shown as Cancelled

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T4 |
| Test Scenario | When an event is cancelled, the attendee's registration is shown as Cancelled |
| Pre-conditions | Automated (CI), against the registration schema: an attendee registered for an event, then the event's `event.listing-changed` message with status `CANCELLED` handled by the registration service's consumer. With F3 merged, the same message is written when the organiser cancels the event. |
| Test Steps | 1. Register for the event.<br>2. Deliver the cancellation message.<br>3. List the attendee's registrations. |
| Test Data | One registration; the event cancelled after it |
| Expected Result | The registration's status is `CANCELLED`, with the time it was cancelled, and the row is kept. Its seat is free again. In the web app, "My registrations" shows it with a `Cancelled` lozenge and no "Withdraw" button. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
