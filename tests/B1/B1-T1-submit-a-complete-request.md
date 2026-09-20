# B1-T1 — Submit a complete event request

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T1 |
| Test Scenario | Submit a complete event request |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Request: the standard request (`tests/README.md`) |
| Expected Result | The request page opens. The status shows "Submitted". A reference of the form `EVT-` followed by six digits is shown under the event name. The submission date and time are shown next to "Submitted". "Organiser" in the side panel shows "Organiser One". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The request page opened with status "Submitted", reference EVT-001710, submitted 9/20/2026, 3:24:52 PM, and Organiser "Organiser One". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/B1/evidence/B1-T1.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
