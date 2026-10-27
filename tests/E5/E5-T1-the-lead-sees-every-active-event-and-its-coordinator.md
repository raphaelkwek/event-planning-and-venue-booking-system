# E5-T1 — The Lead sees every active event with its status and its assigned coordinator, or "Unassigned"; closed events and drafts are left out

## Specification

| Item | Content |
|---|---|
| Test Case ID | E5-T1 |
| Test Scenario | The Lead sees every active event with its status and its assigned coordinator, or "Unassigned"; closed events and drafts are left out |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed (assigned to Coordinator One), a second request FX-ASSIGNED to Coordinator Two, a third FX-SUBMITTED (unassigned), FX-REJECTED (assigned to Coordinator One) and FX-DRAFT.<br>3. Signed in as `lead@connectsphere.test`. |
| Test Steps | 1. Open "Assignments".<br>2. Read each event's row. |
| Test Data | Five events in four statuses |
| Expected Result | The list shows the three active events: the first Under Review with Coordinator One, the second Submitted with Coordinator Two, the third Submitted and "Unassigned". The Rejected request and the draft are not listed. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
