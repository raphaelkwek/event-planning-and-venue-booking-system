# R2-T12 — The attendee receives a registration confirmation notification

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T12 |
| Test Scenario | The attendee receives a registration confirmation notification |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). Kafka configured (`npm run kafka:check` passes).<br>2. R2-T1 done.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Wait a few seconds, then click "Notifications". |
| Test Data | The registration from R2-T1 |
| Expected Result | A notification reads `Your registration REG-… for EVT-… “R Test Symposium” on Wednesday 16 December 2026, 14:00–18:00 is confirmed.`, naming the reference R2-T1 showed. |
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
