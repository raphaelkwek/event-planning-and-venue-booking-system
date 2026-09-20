# C2-T1 — Reopening a draft restores every saved field exactly

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T1 |
| Test Scenario | Reopening a draft restores every saved field exactly |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`.<br>3. "New request" → enter the standard request with the changes in Test Data → "Save draft". |
| Test Steps | 1. Click "My requests".<br>2. Click "Open draft" on "Annual Research Symposium". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Equipment is required: ticked · Attendee registration is required: ticked · Registration opens: 20 November 2026, 09:00 · Registration closes: 1 December 2026, 17:00 |
| Expected Result | Every field shows exactly the value saved: the standard request's name, purpose, description, start, end, attendance and accessibility needs, both checkboxes ticked, and both registration dates and times. |
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Every field came back exactly as saved: Event name "Annual Research Symposium"; Purpose "Share faculty research"; Description "A one-day symposium for the school of computing."; Proposed start "2026-12-02T14:00"; Proposed end "2026-12-02T18:00"; Expected attendance "150"; Accessibility needs "Step-free access to the stage"; Registration opens "2026-11-20T09:00"; Registration closes "2026-12-01T17:00"; both checkboxes ticked. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C2/evidence/C2-T1.png · Defect: — |
| Executed By | Shawmya |
| Date of Execution | 2026-09-20 |
