# T2-T4 — The organiser reads a notification of the approval

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T4 |
| Test Scenario | The organiser reads a notification of the approval |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Open the notifications list. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A notification names the reference and says the request was approved. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

> **Split out of D4-T5 on 2026-09-20.** D4 owns the trigger (D4-T5 checks the emitted
> `event.approved` message); T2 owns the notification record, the read model and the screen this case
> reads. Not Executed until T2 ships in Sprint 2 — see `tests/T2/README.md`.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Awaiting T2 (Sprint 2). |
| Executed By | |
| Date of Execution | |
