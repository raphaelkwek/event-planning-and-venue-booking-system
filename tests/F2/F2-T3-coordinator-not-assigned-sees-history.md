# F2-T3 — An Event Coordinator who is not assigned to the event does not see it or its history

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T3 |
| Test Scenario | An Event Coordinator who is not assigned to the event does not see it or its history |
| Pre-conditions | 1. FX-APPROVED completed.<br>2. Signed in as the seeded coordinator who is **not** named as "Assigned coordinator". |
| Test Steps | 1. Click "All events" and look for the event.<br>2. In the address bar, go to `#/review/<id>` of the event. |
| Test Data | Event: FX-APPROVED; its id |
| Expected Result | Step 1: the event is not listed. Step 2: the page shows "No event with that reference is assigned to you." and no event name, status or history. |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

> **Revised for A4 (CR-05) on 3 Nov 2026.** A3's "coordinators see every event" is superseded: a coordinator has no access to an event not assigned to them.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Coordinator Two did not find the approved event in "All events", and its address showed "No event with that reference is assigned to you." with no event name, status history or assigned coordinator. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6f5ed43 · Evidence: tests/e2e/f-status-and-confirmation.spec.ts › F2-T3 an Event Coordinator who is not assigned to the event does not see it or its history, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41604122084 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
