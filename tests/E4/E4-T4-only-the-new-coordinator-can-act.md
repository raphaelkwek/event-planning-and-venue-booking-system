# E4-T4 — From the reassignment, only the new coordinator can perform coordinator actions on the event; the previous coordinator no longer can

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T4 |
| Test Scenario | From the reassignment, only the new coordinator can perform coordinator actions on the event; the previous coordinator no longer can |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed: the request assigned to Coordinator One and approved (G1 edits an Approved event).<br>3. Reassigned to Coordinator Two by `lead@connectsphere.test`, as in E4-T1. |
| Test Steps | 1. Sign in as `coordinator@connectsphere.test`, look for the request in "All events", then go to `#/review/<id>`; then send `PATCH /event/api/v1/events/<id>` through the API console with a new purpose.<br>2. Sign in as `coordinator2@connectsphere.test`, open the request, click "Edit details", change the purpose and save. |
| Test Data | Purpose `Share faculty research across schools` |
| Expected Result | Coordinator One no longer has the request in "All events", the page shows "No event with that reference is assigned to you.", and the API refuses the edit with `404` `EVENT_NOT_FOUND` and the same message; nothing changes. Coordinator Two's edit is saved. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** From the reassignment the previous coordinator can't open the event at all, and the API answers 404.

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the Lead's reassignment, Coordinator One's All events lacked the event and the review link showed `No event with that reference is assigned to you.`; the console PATCH returned 404 EVENT_NOT_FOUND with that message and SQL showed the purpose unchanged with no field-change history; Coordinator Two's Edit details saved (`Details saved.`) and SQL showed the new purpose with one field-change row. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/e-access-and-console.spec.ts › E4-T4 from the reassignment, only the new coordinator can perform coordinator actions on the event, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
