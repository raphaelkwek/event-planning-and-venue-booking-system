# T2-T1 — The assigned coordinator reads a notification that a request awaits review

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T1 |
| Test Scenario | The assigned coordinator reads a notification that a request awaits review |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Open the notifications list. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A notification names the reference and says a new event request is awaiting review. |
| Created By | Joash Lau Rong Wei |
| Date of Creation | 2026-09-17 |

> **Split out of B1-T5 on 2026-09-20.** B1 owns the trigger (B1-T5 checks the emitted
> `event.submitted` message); T2 owns the notification record, the read model and the screen this
> case reads. Not Executed until T2 ships in Sprint 2 — see `tests/T2/README.md`.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The coordinator's list showed: "Event request EVT-004520 “Annual Research Symposium” has been assigned to you and is awaiting your review. 10/4/2026, 4:40:11 PM UNREAD Open Mark as read". |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
