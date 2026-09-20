# T2-T3 — The coordinator who asked reads a notification that the organiser has responded

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T3 |
| Test Scenario | The coordinator who asked reads a notification that the organiser has responded |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed, then the organiser responds with `Answered.`. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Open the notifications list. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A notification names the request and says the organiser has responded. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

> **Split out of D3-T8 on 2026-09-20.** D3 owns the trigger (D3-T8 checks the emitted
> `event.clarification-responded` message); T2 owns the notification record, the read model and the
> screen this case reads. Not Executed until T2 ships in Sprint 2 — see `tests/T2/README.md`.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Awaiting T2 (Sprint 2). |
| Executed By | |
| Date of Execution | |
