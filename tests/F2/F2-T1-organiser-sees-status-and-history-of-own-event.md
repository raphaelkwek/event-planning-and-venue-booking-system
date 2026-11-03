# F2-T1 — The owning organiser sees the current status and the full history of their own event

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T1 |
| Test Scenario | The owning organiser sees the current status and the full history of their own event |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed (submitted by `organiser@connectsphere.test`, approved by the assigned coordinator).<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Go to "My requests" and open the approved request.<br>2. Read the Status panel and the "Status history" section. |
| Test Data | Event: FX-APPROVED |
| Expected Result | Step 2: the Status panel shows `Approved`. "Status history" lists three entries, oldest first: Draft to Submitted (Event Organiser), Submitted to Under Review (Event Coordinator), Under Review to Approved (Event Coordinator), each with a date and time. |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Status Approved and three rows oldest first (Draft→Submitted by Event Organiser, Submitted→Under Review and Under Review→Approved by Event Coordinator), each with a time. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/f-status-and-confirmation.spec.ts › F2-T1 the owning organiser sees the current status and the full history of their event, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
