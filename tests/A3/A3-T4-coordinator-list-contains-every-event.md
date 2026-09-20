# A3-T4 — A coordinator's event list contains every event, whoever owns it

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T4 |
| Test Scenario | A coordinator's event list contains every event, whoever owns it |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser@connectsphere.test`: FX-APPROVED.<br>3. As `organiser2@connectsphere.test`: FX-SUBMITTED with Event name `Organiser two's symposium`.<br>4. As `organiser@connectsphere.test`: FX-DRAFT with Event name `Unfinished idea`.<br>5. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "All events". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "Annual Research Symposium" is listed with status "Approved" and "Organiser two's symposium" with status "Submitted", whoever each is assigned to. "Unfinished idea", another user's draft, is not listed. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Both organisers' requests were listed — "Annual Research Symposium" as Approved and "Organiser two's symposium" as Submitted — while the other user's draft "Unfinished idea" was not listed. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A3/evidence/A3-T4.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
