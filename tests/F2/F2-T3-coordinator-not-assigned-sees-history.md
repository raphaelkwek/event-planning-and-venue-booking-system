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
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-03; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |
