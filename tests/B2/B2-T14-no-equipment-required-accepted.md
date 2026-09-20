# B2-T14 — "No equipment required" is accepted as a complete equipment answer

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T14 |
| Test Scenario | "No equipment required" is accepted as a complete equipment answer |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, leaving "Equipment is required" unticked.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Equipment is required: unticked |
| Expected Result | The request page opens with status "Submitted" and a reference of the form `EVT-` followed by six digits. On the request page, "Equipment requirements" shows "None required". (Shown as "Equipment required: No" until 2026-09-17, when venue and equipment requirements were added to the form and the request page.) |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Submission succeeded as EVT-001888 with status Submitted, and the detail screen showed “Equipment requirements — None required”. |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B2/evidence/B2-T14-2026-09-20.png · Defect: — |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |